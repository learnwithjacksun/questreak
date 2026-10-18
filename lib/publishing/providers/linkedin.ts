import { fetchBytes, fetchRange, remoteSize } from "../media";
import { env, form, json, request, sleep } from "../http";
import { escapeLittleText } from "../text";
import {
  PublishError,
  type AccountCtx,
  type AuthorizeCtx,
  type ConnectedAccount,
  type ExchangeCtx,
  type Provider,
  type PublishInput,
  type PublishResult,
} from "../types";

/**
 * LinkedIn: personal profile posting with `w_member_social` ("Share on LinkedIn" +
 * "Sign In with LinkedIn using OpenID Connect" products). Company Pages need the separate
 * Community Management API approval and `w_organization_social`.
 *
 * Access tokens last 60 days and LinkedIn only issues refresh tokens to approved partners, so an
 * expired account is marked "expired" and the user reconnects.
 */

const SCOPES = ["openid", "profile", "w_member_social"];
const REST = "https://api.linkedin.com/rest";

/** LinkedIn versions are YYYYMM and are retired after about a year, so keep this current. */
const version = () => process.env.LINKEDIN_API_VERSION || "202609";

const headers = (token: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${token}`,
  "Linkedin-Version": version(),
  "X-Restli-Protocol-Version": "2.0.0",
  ...extra,
});

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: env("LINKEDIN_CLIENT_ID"),
    redirect_uri: ctx.redirectUri,
    state: ctx.state,
    scope: SCOPES.join(" "),
  }).toString();
  return url.toString();
}

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const tokenRes = await request("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    body: form({
      grant_type: "authorization_code",
      code: ctx.code,
      redirect_uri: ctx.redirectUri,
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
    }),
  });
  const token = await json<{ access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number }>(
    tokenRes,
    "LinkedIn",
  );

  const meRes = await request("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = await json<{ sub: string; name?: string; given_name?: string; picture?: string; email?: string }>(meRes, "LinkedIn");

  return [
    {
      platform: "linkedin",
      externalId: me.sub,
      handle: me.email ?? me.name ?? me.sub,
      displayName: me.name ?? me.given_name ?? "LinkedIn member",
      avatar: me.picture,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      refreshExpiresAt: token.refresh_token_expires_in ? new Date(Date.now() + token.refresh_token_expires_in * 1000) : undefined,
      scopes: SCOPES,
    },
  ];
}

async function refresh(account: AccountCtx) {
  if (!account.refreshToken) {
    throw new PublishError("Your LinkedIn connection expired. Reconnect the account to keep posting.", { reconnect: true });
  }
  const res = await request("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    body: form({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
    }),
  });
  const body = await json<{ access_token: string; expires_in: number; refresh_token?: string }>(res, "LinkedIn");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? account.refreshToken,
    expiresAt: new Date(Date.now() + body.expires_in * 1000),
  };
}

async function uploadImage(token: string, owner: string, url: string): Promise<string> {
  const initRes = await request(`${REST}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const { value } = await json<{ value: { uploadUrl: string; image: string } }>(initRes, "LinkedIn");

  const { data, contentType } = await fetchBytes(url, { maxBytes: 20_000_000 });
  const put = await request(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: new Uint8Array(data),
    timeoutMs: 120_000,
  });
  if (!put.ok) await json(put, "LinkedIn");
  return value.image;
}

async function uploadVideo(token: string, owner: string, url: string): Promise<string> {
  const size = await remoteSize(url);
  if (size > 500 * 1024 * 1024) throw new PublishError("LinkedIn videos can be at most 500 MB.");

  const initRes = await request(`${REST}/videos?action=initializeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } }),
  });
  const { value } = await json<{
    value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] };
  }>(initRes, "LinkedIn");

  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const chunk = await fetchRange(url, part.firstByte, Math.min(part.lastByte, size - 1));
    const put = await request(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(chunk),
      timeoutMs: 120_000,
    });
    if (!put.ok) await json(put, "LinkedIn");
    const etag = put.headers.get("etag");
    if (!etag) throw new PublishError("LinkedIn didn't confirm a video part upload.");
    etags.push(etag.replace(/^"|"$/g, ""));
  }

  const finRes = await request(`${REST}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken ?? "", uploadedPartIds: etags } }),
  });
  if (!finRes.ok) await json(finRes, "LinkedIn");

  for (let i = 0; i < 60; i++) {
    const st = await request(`${REST}/videos/${encodeURIComponent(value.video)}`, { headers: headers(token) });
    const body = await json<{ status?: string; processingFailureReason?: string }>(st, "LinkedIn");
    if (body.status === "AVAILABLE") return value.video;
    if (body.status === "PROCESSING_FAILED") throw new PublishError(body.processingFailureReason || "LinkedIn couldn't process the video.");
    await sleep(3_000);
  }
  throw new PublishError("LinkedIn is still processing the video. Try again in a few minutes.", { retryable: true });
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const author = `urn:li:person:${account.externalId}`;
  const commentary = escapeLittleText(input.text.trim());
  if (Array.from(input.text).length > 3000) throw new PublishError("LinkedIn posts are limited to 3,000 characters.");

  const images = input.media.filter((m) => m.type === "image");
  const video = input.media.find((m) => m.type === "video");

  let content: Record<string, unknown> | undefined;
  if (video) {
    content = { media: { title: input.text.trim().split("\n")[0].slice(0, 200) || "Video", id: await uploadVideo(token, author, video.url) } };
  } else if (images.length === 1) {
    content = { media: { id: await uploadImage(token, author, images[0].url) } };
  } else if (images.length > 1) {
    const ids: string[] = [];
    for (const img of images.slice(0, 20)) ids.push(await uploadImage(token, author, img.url));
    content = { multiImage: { images: ids.map((id) => ({ id })) } };
  }

  const res = await request(`${REST}/posts`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) await json(res, "LinkedIn");
  const urn = res.headers.get("x-restli-id") ?? undefined;
  return { externalId: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : undefined };
}

export const linkedin: Provider = {
  key: "linkedin",
  env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 7 * 24 * 60 * 60 * 1000,
};

