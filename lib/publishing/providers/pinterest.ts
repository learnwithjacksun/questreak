import { basicAuth, env, form, json, request, sleep } from "../http";
import { cloudinaryVariant, fetchBytes, jpegVariant, toBlob } from "../media";
import { firstUrl, toTitle } from "../text";
import {
  PublishError,
  type AccountCtx,
  type AuthorizeCtx,
  type ConnectedAccount,
  type ExchangeCtx,
  type Provider,
  type PublishInput,
  type PublishResult,
  type TokenSet,
} from "../types";

/**
 * Pinterest API v5. Apps start with "Trial" access: pins and boards can be created but are only
 * visible to their creator, until Standard access is granted. The normal API host is used for both
 * (the sandbox host takes hand-generated tokens, not the OAuth flow, so it isn't needed here).
 */

const base = () => (process.env.PINTEREST_API_BASE || "https://api.pinterest.com/v5").replace(/\/$/, "");
const SCOPES = ["boards:read", "pins:read", "pins:write", "user_accounts:read"];

const clientAuth = () => ({ Authorization: basicAuth(env("PINTEREST_APP_ID"), env("PINTEREST_APP_SECRET")) });

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://www.pinterest.com/oauth/");
  url.search = new URLSearchParams({
    client_id: env("PINTEREST_APP_ID"),
    redirect_uri: ctx.redirectUri,
    response_type: "code",
    scope: SCOPES.join(","),
    state: ctx.state,
  }).toString();
  return url.toString();
}

type TokenBody = { access_token: string; refresh_token?: string; expires_in: number; refresh_token_expires_in?: number; scope?: string };

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const res = await request(`${base()}/oauth/token`, {
    method: "POST",
    headers: clientAuth(),
    body: form({
      grant_type: "authorization_code",
      code: ctx.code,
      redirect_uri: ctx.redirectUri,
      continuous_refresh: true, // refresh tokens that renew themselves
    }),
  });
  const token = await json<TokenBody>(res, "Pinterest");

  const meRes = await request(`${base()}/user_account`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  const me = await json<{ username: string; profile_image?: string; id?: string }>(meRes, "Pinterest");

  return [
    {
      platform: "pinterest",
      externalId: me.id ?? me.username,
      handle: me.username,
      displayName: me.username,
      avatar: me.profile_image,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      refreshExpiresAt: token.refresh_token_expires_in ? new Date(Date.now() + token.refresh_token_expires_in * 1000) : undefined,
      scopes: token.scope?.split(/[ ,]/) ?? SCOPES,
    },
  ];
}

async function refresh(account: AccountCtx): Promise<TokenSet> {
  if (!account.refreshToken) throw new PublishError("Your Pinterest connection expired. Reconnect the account.", { reconnect: true });
  const res = await request(`${base()}/oauth/token`, {
    method: "POST",
    headers: clientAuth(),
    body: form({ grant_type: "refresh_token", refresh_token: account.refreshToken }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new PublishError("Your Pinterest connection expired. Reconnect the account.", { reconnect: true });
  }
  const body = await json<TokenBody>(res, "Pinterest");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? account.refreshToken,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    refreshExpiresAt: body.refresh_token_expires_in ? new Date(Date.now() + body.refresh_token_expires_in * 1000) : undefined,
  };
}

export type PinterestBoard = { id: string; name: string; privacy?: string };

export async function listBoards(accessToken: string): Promise<PinterestBoard[]> {
  const out: PinterestBoard[] = [];
  let bookmark: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ page_size: "100", ...(bookmark ? { bookmark } : {}) });
    const res = await request(`${base()}/boards?${q}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await json<{ items?: PinterestBoard[]; bookmark?: string | null }>(res, "Pinterest");
    out.push(...(body.items ?? []));
    if (!body.bookmark) break;
    bookmark = body.bookmark;
  }
  return out;
}

/** A still frame from a Cloudinary video, used as the required pin cover. */
function videoCover(url: string): string {
  const withFrame = cloudinaryVariant(url, "so_1,f_jpg,w_1080,c_limit");
  return withFrame.replace(/\.[a-z0-9]{2,5}(\?.*)?$/i, ".jpg$1");
}

async function uploadVideo(token: string, url: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };
  const regRes = await request(`${base()}/media`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "video" }),
  });
  const reg = await json<{ media_id: string; upload_url: string; upload_parameters: Record<string, string> }>(regRes, "Pinterest");

  const { data, contentType } = await fetchBytes(url, { maxBytes: 2_000_000_000 });
  const body = new FormData();
  for (const [k, v] of Object.entries(reg.upload_parameters)) body.append(k, v);
  body.append("file", toBlob(data, contentType), "video.mp4"); // the file must be the last field
  const up = await request(reg.upload_url, { method: "POST", body, timeoutMs: 300_000 });
  if (!up.ok && up.status !== 204) throw new PublishError(`Pinterest rejected the video upload (${up.status}).`);

  for (let i = 0; i < 60; i++) {
    await sleep(3_000);
    const st = await request(`${base()}/media/${reg.media_id}`, { headers: auth });
    const body2 = await json<{ status: string }>(st, "Pinterest");
    if (body2.status === "succeeded") return reg.media_id;
    if (body2.status === "failed") throw new PublishError("Pinterest couldn't process the video.");
  }
  throw new PublishError("Pinterest is still processing the video. Try again shortly.", { retryable: true });
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const opts = input.options.pinterest ?? {};

  let boardId = opts.boardId || (account.meta.boardId as string | undefined);
  if (!boardId) {
    const boards = await listBoards(token);
    boardId = boards[0]?.id;
    if (!boardId) throw new PublishError("This Pinterest account has no boards. Create a board first.");
  }

  const images = input.media.filter((m) => m.type === "image");
  const video = input.media.find((m) => m.type === "video");
  let media_source: Record<string, unknown>;
  if (video) {
    media_source = { source_type: "video_id", media_id: await uploadVideo(token, video.url), cover_image_url: videoCover(video.url) };
  } else if (images.length === 1) {
    media_source = { source_type: "image_url", url: jpegVariant(images[0].url, { width: 2000 }) };
  } else if (images.length > 1) {
    media_source = { source_type: "multiple_image_urls", items: images.slice(0, 5).map((m) => ({ url: jpegVariant(m.url, { width: 2000 }) })) };
  } else {
    throw new PublishError("Pinterest pins need an image or video.");
  }

  const link = opts.link?.trim() || firstUrl(input.text);
  const res = await request(`${base()}/pins`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: boardId,
      title: (opts.title?.trim() || toTitle(input.text, 100)).slice(0, 100),
      description: input.text.trim().slice(0, 800),
      ...(link ? { link } : {}),
      media_source,
    }),
    timeoutMs: 60_000,
  });
  const pin = await json<{ id: string }>(res, "Pinterest");
  return { externalId: pin.id, url: `https://www.pinterest.com/pin/${pin.id}/` };
}

export const pinterest: Provider = {
  key: "pinterest",
  env: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 3 * 24 * 60 * 60 * 1000,
};
