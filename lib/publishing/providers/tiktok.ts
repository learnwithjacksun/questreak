import { env, form, request, sleep } from "../http";
import { fetchRange, jpegVariant, remoteSize, videoMime } from "../media";
import { publicMediaUrl } from "../public-media";
import { toTitle } from "../text";
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
 * TikTok Content Posting API (Direct Post). Until TikTok audits the app, every post is forced
 * private (SELF_ONLY); set TIKTOK_AUDITED=true after the audit passes.
 *
 * Videos are sent with FILE_UPLOAD (we push chunks), so no domain verification is needed.
 * Photos can only be pulled from a URL, so they go through our verified-domain media proxy.
 */

const API = "https://open.tiktokapis.com/v2";
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];

export const tiktokAudited = () => process.env.TIKTOK_AUDITED === "true";

type TikTokEnvelope<T> = { data?: T; error?: { code: string; message?: string; log_id?: string } };

/** TikTok answers 200 with `error.code: "ok"` on success, and puts failures in `error`. */
async function api<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON */
  }
  const code: string | undefined = body?.error?.code ?? (typeof body?.error === "string" ? body.error : undefined);
  if (res.ok && (!code || code === "ok")) return body as T;

  const message: string = body?.error?.message || body?.error_description || `TikTok returned ${res.status}.`;
  const reconnect = res.status === 401 || code === "access_token_invalid" || code === "scope_not_authorized";
  const friendly: Record<string, string> = {
    unaudited_client_can_only_post_to_private_accounts:
      "TikTok only allows private accounts to post until the app passes its audit. Set the TikTok account to private, or wait for audit approval.",
    spam_risk_too_many_posts: "This TikTok account reached its daily posting limit. Try again tomorrow.",
    reached_active_user_cap: "TikTok's daily limit for this app was reached. Try again later.",
    url_ownership_unverified: "TikTok hasn't verified our media domain yet, so photo posts can't be sent.",
    privacy_level_option_mismatch: "That visibility isn't available for this TikTok account.",
    rate_limit_exceeded: "TikTok rate limit reached. Try again in a minute.",
  };
  throw new PublishError(friendly[code ?? ""] ?? message, {
    reconnect,
    retryable: res.status === 429 || res.status >= 500 || code === "rate_limit_exceeded",
  });
}

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.search = new URLSearchParams({
    client_key: env("TIKTOK_CLIENT_KEY"),
    scope: SCOPES.join(","),
    response_type: "code",
    redirect_uri: ctx.redirectUri,
    state: ctx.state,
  }).toString();
  return url.toString();
}

type TokenBody = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope?: string;
};

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const res = await request(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Cache-Control": "no-cache" },
    body: form({
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      code: ctx.code,
      grant_type: "authorization_code",
      redirect_uri: ctx.redirectUri,
    }),
  });
  const token = await api<TokenBody>(res);

  const meRes = await request(`${API}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = (await api<TikTokEnvelope<{ user: { open_id: string; display_name?: string; avatar_url?: string } }>>(meRes)).data?.user;

  return [
    {
      platform: "tiktok",
      externalId: token.open_id,
      handle: me?.display_name ?? token.open_id,
      displayName: me?.display_name ?? "TikTok creator",
      avatar: me?.avatar_url,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      refreshExpiresAt: new Date(Date.now() + token.refresh_expires_in * 1000),
      scopes: token.scope?.split(",") ?? SCOPES,
    },
  ];
}

async function refresh(account: AccountCtx): Promise<TokenSet> {
  if (!account.refreshToken) throw new PublishError("Your TikTok connection expired. Reconnect the account.", { reconnect: true });
  const res = await request(`${API}/oauth/token/`, {
    method: "POST",
    body: form({
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new PublishError("Your TikTok connection expired. Reconnect the account.", { reconnect: true });
  }
  const body = await api<TokenBody>(res);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? account.refreshToken,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + body.refresh_expires_in * 1000),
  };
}

export type CreatorInfo = {
  creator_nickname: string;
  creator_username?: string;
  creator_avatar_url?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
};

/** TikTok requires this to be fetched fresh each time the posting form is shown. */
export async function fetchCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  const res = await request(`${API}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: "{}",
  });
  const body = await api<TikTokEnvelope<CreatorInfo>>(res);
  if (!body.data) throw new PublishError("TikTok didn't return creator details.");
  return body.data;
}

async function poll(token: string, publishId: string): Promise<PublishResult> {
  for (let i = 0; i < 40; i++) {
    await sleep(3_000);
    const res = await request(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const body = await api<TikTokEnvelope<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>>(res);
    const st = body.data?.status;
    if (st === "PUBLISH_COMPLETE") {
      const id = body.data?.publicaly_available_post_id?.[0];
      return { externalId: id ? String(id) : publishId };
    }
    if (st === "FAILED") throw new PublishError(`TikTok couldn't publish the post${body.data?.fail_reason ? `: ${body.data.fail_reason}` : "."}`);
  }
  // Still processing: TikTok finishes in the background, so don't fail the post.
  return { externalId: publishId, note: "TikTok is still processing this post. It should appear on the profile shortly." };
}

/** Chunking rules: files under 5 MB go in one piece; otherwise 10 MB chunks and the last absorbs the remainder. */
export function chunkPlan(size: number): { chunkSize: number; count: number } {
  const MIN = 5 * 1024 * 1024;
  if (size < MIN) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * 1000 * 1000;
  const count = Math.max(1, Math.floor(size / chunkSize));
  // A single chunk must cover the whole file, otherwise TikTok rejects the declared sizes.
  return { chunkSize: count === 1 ? size : chunkSize, count };
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const opt = input.options.tiktok?.[input.accountId] ?? {};
  if (!opt.privacy) throw new PublishError("Choose who can view this TikTok post.");

  const info = await fetchCreatorInfo(token);
  const audited = tiktokAudited();
  const privacy = audited ? opt.privacy : "SELF_ONLY";
  if (!info.privacy_level_options.includes(privacy)) {
    throw new PublishError("That visibility isn't available for this TikTok account.");
  }

  const brandContent = !!opt.commercial && !!opt.brandedContent;
  const brandOrganic = !!opt.commercial && !!opt.yourBrand;
  if (opt.commercial && !brandContent && !brandOrganic) {
    throw new PublishError("Say whether the content promotes your brand, a third party, or both.");
  }
  if (brandContent && privacy === "SELF_ONLY") throw new PublishError("Branded content can't be private on TikTok.");

  const video = input.media.find((m) => m.type === "video");
  const images = input.media.filter((m) => m.type === "image");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };
  const common = {
    privacy_level: privacy,
    disable_comment: info.comment_disabled || !opt.comment,
    brand_content_toggle: brandContent,
    brand_organic_toggle: brandOrganic,
  };

  if (video) {
    const size = await remoteSize(video.url);
    const { chunkSize, count } = chunkPlan(size);
    const initRes = await request(`${API}/post/publish/video/init/`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        post_info: {
          title: input.text.trim().slice(0, 2200),
          ...common,
          disable_duet: info.duet_disabled || !opt.duet,
          disable_stitch: info.stitch_disabled || !opt.stitch,
        },
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: count },
      }),
    });
    const init = await api<TikTokEnvelope<{ publish_id: string; upload_url: string }>>(initRes);
    const { publish_id, upload_url } = init.data ?? ({} as { publish_id: string; upload_url: string });
    if (!publish_id || !upload_url) throw new PublishError("TikTok didn't return an upload address.");

    const mime = videoMime(video.url);
    for (let i = 0; i < count; i++) {
      const first = i * chunkSize;
      const last = i === count - 1 ? size - 1 : first + chunkSize - 1;
      const chunk = await fetchRange(video.url, first, last);
      const put = await request(upload_url, {
        method: "PUT",
        headers: { "Content-Type": mime, "Content-Length": String(chunk.length), "Content-Range": `bytes ${first}-${last}/${size}` },
        body: new Uint8Array(chunk),
        timeoutMs: 180_000,
      });
      if (!put.ok && put.status !== 206) {
        throw new PublishError(`TikTok rejected a video chunk (${put.status}).`, { retryable: put.status >= 500 });
      }
    }
    return poll(token, publish_id);
  }

  if (images.length) {
    const urls = await Promise.all(images.slice(0, 35).map((m) => publicMediaUrl(jpegVariant(m.url, { width: 1920 }))));
    const initRes = await request(`${API}/post/publish/content/init/`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        media_type: "PHOTO",
        post_mode: "DIRECT_POST",
        post_info: { title: toTitle(input.text, 90), description: input.text.trim().slice(0, 4000), ...common },
        source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: urls },
      }),
    });
    const init = await api<TikTokEnvelope<{ publish_id: string }>>(initRes);
    if (!init.data?.publish_id) throw new PublishError("TikTok didn't accept the photo post.");
    return poll(token, init.data.publish_id);
  }

  throw new PublishError("TikTok posts need a video or photos.");
}

export const tiktok: Provider = {
  key: "tiktok",
  env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 60 * 60 * 1000,
};
