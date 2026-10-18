import { fetchBytes, remoteSize, fetchRange, toBlob, extensionOf } from "../media";
import { basicAuth, env, form, json, request, sleep } from "../http";
import { challengeFor } from "../pkce";
import { xLength } from "../text";
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

/** X API v2 with OAuth 2.0 (PKCE). Posting is a paid API tier, so surface billing errors clearly. */

const API = "https://api.x.com/2";
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];
const CHUNK = 4 * 1024 * 1024;

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: env("X_CLIENT_ID"),
    redirect_uri: ctx.redirectUri,
    scope: SCOPES.join(" "),
    state: ctx.state,
    code_challenge: challengeFor(ctx.verifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

const clientAuth = () => ({ Authorization: basicAuth(env("X_CLIENT_ID"), env("X_CLIENT_SECRET")) });

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const res = await request(`${API}/oauth2/token`, {
    method: "POST",
    headers: clientAuth(),
    body: form({
      grant_type: "authorization_code",
      code: ctx.code,
      redirect_uri: ctx.redirectUri,
      code_verifier: ctx.verifier,
      client_id: env("X_CLIENT_ID"),
    }),
  });
  const token = await json<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(res, "X");

  const meRes = await request(`${API}/users/me?user.fields=profile_image_url,username,name`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = (await json<{ data: { id: string; username: string; name: string; profile_image_url?: string } }>(meRes, "X")).data;

  return [
    {
      platform: "x",
      externalId: me.id,
      handle: me.username,
      displayName: me.name,
      avatar: me.profile_image_url,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope?.split(" ") ?? SCOPES,
    },
  ];
}

/** X rotates refresh tokens: every refresh returns a new one that must replace the old. */
async function refresh(account: AccountCtx): Promise<TokenSet> {
  if (!account.refreshToken) throw new PublishError("Your X connection expired. Reconnect the account.", { reconnect: true });
  const res = await request(`${API}/oauth2/token`, {
    method: "POST",
    headers: clientAuth(),
    body: form({ grant_type: "refresh_token", refresh_token: account.refreshToken, client_id: env("X_CLIENT_ID") }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new PublishError("Your X connection expired. Reconnect the account.", { reconnect: true });
  }
  const body = await json<{ access_token: string; refresh_token?: string; expires_in: number }>(res, "X");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? account.refreshToken,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
  };
}

async function waitForProcessing(token: string, mediaId: string, info?: { state?: string; check_after_secs?: number }) {
  let state = info;
  for (let i = 0; i < 60 && state && (state.state === "pending" || state.state === "in_progress"); i++) {
    await sleep(Math.max(1, state.check_after_secs ?? 2) * 1000);
    const res = await request(`${API}/media/upload?command=STATUS&media_id=${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await json<{ data?: { processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } } } }>(res, "X");
    state = body.data?.processing_info;
    if (state?.state === "failed") {
      throw new PublishError((state as { error?: { message?: string } }).error?.message ?? "X couldn't process the video.");
    }
  }
  if (state && (state.state === "pending" || state.state === "in_progress")) {
    throw new PublishError("X is still processing the video. Try again in a few minutes.", { retryable: true });
  }
}

async function uploadImage(token: string, url: string): Promise<string> {
  const { data, contentType } = await fetchBytes(url, { maxBytes: 5 * 1024 * 1024 });
  const isGif = contentType === "image/gif" || extensionOf(url) === "gif";
  const body = new FormData();
  body.append("media", toBlob(data, contentType), isGif ? "image.gif" : "image");
  body.append("media_category", isGif ? "tweet_gif" : "tweet_image");
  const res = await request(`${API}/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    timeoutMs: 120_000,
  });
  return (await json<{ data: { id: string } }>(res, "X")).data.id;
}

async function uploadVideo(token: string, url: string): Promise<string> {
  const size = await remoteSize(url);
  const auth = { Authorization: `Bearer ${token}` };

  const initRes = await request(`${API}/media/upload/initialize`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ total_bytes: size, media_type: extensionOf(url) === "mov" ? "video/quicktime" : "video/mp4", media_category: "tweet_video" }),
  });
  const id = (await json<{ data: { id: string } }>(initRes, "X")).data.id;

  for (let i = 0, offset = 0; offset < size; i++, offset += CHUNK) {
    const chunk = await fetchRange(url, offset, Math.min(offset + CHUNK, size) - 1);
    const body = new FormData();
    body.append("media", toBlob(chunk, "application/octet-stream"), "chunk");
    body.append("segment_index", String(i));
    const res = await request(`${API}/media/upload/${id}/append`, { method: "POST", headers: auth, body, timeoutMs: 120_000 });
    if (!res.ok) await json(res, "X");
  }

  const finRes = await request(`${API}/media/upload/${id}/finalize`, { method: "POST", headers: auth, timeoutMs: 60_000 });
  const fin = await json<{ data?: { processing_info?: { state?: string; check_after_secs?: number } } }>(finRes, "X");
  await waitForProcessing(token, id, fin.data?.processing_info);
  return id;
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const text = input.text.trim();
  if (xLength(text) > 280) throw new PublishError("X posts are limited to 280 characters.");

  const images = input.media.filter((m) => m.type === "image");
  const video = input.media.find((m) => m.type === "video");

  const mediaIds: string[] = [];
  if (video) mediaIds.push(await uploadVideo(token, video.url));
  else for (const img of images.slice(0, 4)) mediaIds.push(await uploadImage(token, img.url));

  const res = await request(`${API}/tweets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...(text ? { text } : {}), ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
  });
  if (res.status === 402) {
    throw new PublishError("X rejected the post because the X API account has no posting credits or an active plan.");
  }
  const body = await json<{ data: { id: string } }>(res, "X");
  return { externalId: body.data.id, url: `https://x.com/${account.handle}/status/${body.data.id}` };
}

export const x: Provider = {
  key: "x",
  env: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 10 * 60 * 1000,
};
