import { randomUUID } from "node:crypto";
import { fetchBytes, toBlob } from "../media";
import { form, json, request, sleep } from "../http";
import { extractUrls } from "../text";
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
 * Mastodon is federated: every server is its own OAuth provider. We register one OAuth app per
 * server the first time someone connects to it (RFC 7591 style, via POST /api/v1/apps).
 */

const SCOPES = "read:accounts write:statuses write:media";

/** Accepts "mastodon.social", "https://mastodon.social/" or "@me@mastodon.social". */
export function normalizeInstance(input: string): string {
  let raw = input.trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at > -1 && !raw.startsWith("http")) raw = raw.slice(at + 1);
  const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  const host = url.hostname;
  const isDev = process.env.NODE_ENV !== "production";
  const looksPrivate =
    !host.includes(".") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "localhost";
  // The instance comes from the user and we fetch it server-side, so block internal addresses.
  if (looksPrivate && !isDev) throw new PublishError("Enter a public Mastodon server, like mastodon.social.");
  if (url.protocol !== "https:" && !isDev) throw new PublishError("The Mastodon server must use https.");
  return url.origin;
}

async function getApp(instance: string, redirectUri: string) {
  // Loaded lazily: publishing never touches the database, so it stays light and easy to test.
  const [{ decrypt, encrypt }, { connectDB }, { MastodonApp }] = await Promise.all([
    import("@/lib/crypto"),
    import("@/lib/db"),
    import("@/models/mastodon-app"),
  ]);
  await connectDB();
  const existing = await MastodonApp.findOne({ instance, redirectUri });
  if (existing) return { clientId: existing.clientId, clientSecret: decrypt(existing.clientSecretEnc) };

  const res = await request(`${instance}/api/v1/apps`, {
    method: "POST",
    body: form({
      client_name: "Questreak",
      redirect_uris: redirectUri,
      scopes: SCOPES,
      website: (process.env.APP_URL ?? "").replace(/\/$/, "") || undefined,
    }),
  });
  const app = await json<{ client_id: string; client_secret: string }>(res, "Mastodon");
  await MastodonApp.findOneAndUpdate(
    { instance },
    { instance, redirectUri, clientId: app.client_id, clientSecretEnc: encrypt(app.client_secret) },
    { upsert: true },
  );
  return { clientId: app.client_id, clientSecret: app.client_secret };
}

async function authorize(ctx: AuthorizeCtx): Promise<string> {
  const instance = normalizeInstance(ctx.extra.instance ?? "");
  const { clientId } = await getApp(instance, ctx.redirectUri);
  const url = new URL(`${instance}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: ctx.redirectUri,
    scope: SCOPES,
    state: ctx.state,
  }).toString();
  return url.toString();
}

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const instance = normalizeInstance(ctx.extra.instance ?? "");
  const { clientId, clientSecret } = await getApp(instance, ctx.redirectUri);

  const tokenRes = await request(`${instance}/oauth/token`, {
    method: "POST",
    body: form({
      grant_type: "authorization_code",
      code: ctx.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: ctx.redirectUri,
      scope: SCOPES,
    }),
  });
  const token = await json<{ access_token: string }>(tokenRes, "Mastodon");

  const meRes = await request(`${instance}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = await json<{ id: string; username: string; acct: string; display_name: string; avatar: string; url: string }>(
    meRes,
    "Mastodon",
  );
  const host = new URL(instance).host;
  const limits = await instanceLimits(instance);
  return [
    {
      platform: "mastodon",
      externalId: `${me.username}@${host}`,
      handle: `@${me.username}@${host}`,
      displayName: me.display_name || me.username,
      avatar: me.avatar,
      accessToken: token.access_token, // Mastodon tokens don't expire
      scopes: SCOPES.split(" "),
      meta: { instance, accountId: me.id, profileUrl: me.url, maxChars: limits.maxChars, maxMedia: limits.maxMedia },
    },
  ];
}

/** Server limits are configurable per instance, so ask it. */
async function instanceLimits(instance: string) {
  const defaults = { maxChars: 500, maxMedia: 4, imageBytes: 16_000_000, videoBytes: 99_000_000 };
  const res = await request(`${instance}/api/v2/instance`, { timeoutMs: 10_000 }).catch(() => null);
  if (!res?.ok) return defaults;
  const body: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
  const c = body.configuration ?? {};
  return {
    maxChars: c.statuses?.max_characters ?? defaults.maxChars,
    maxMedia: c.statuses?.max_media_attachments ?? defaults.maxMedia,
    imageBytes: c.media_attachments?.image_size_limit ?? defaults.imageBytes,
    videoBytes: c.media_attachments?.video_size_limit ?? defaults.videoBytes,
  };
}

/** Mastodon counts every link as 23 characters. */
function statusLength(text: string) {
  const urls = extractUrls(text);
  return Array.from(text.replace(/https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/g, "")).length + urls.length * 23;
}

async function uploadMedia(instance: string, token: string, url: string, type: "image" | "video", maxBytes: number) {
  const { data, contentType } = await fetchBytes(url, { maxBytes });
  const body = new FormData();
  body.append("file", toBlob(data, contentType), type === "video" ? "video.mp4" : "image");
  const res = await request(`${instance}/api/v2/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    timeoutMs: 120_000,
  });
  const media = await json<{ id: string }>(res, "Mastodon");
  if (res.status === 202) {
    // Videos are processed in the background; wait until the attachment is ready (HTTP 200).
    for (let i = 0; i < 60; i++) {
      await sleep(2_000);
      const poll = await request(`${instance}/api/v1/media/${media.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (poll.status === 200) return media.id;
      if (poll.status !== 206) await json(poll, "Mastodon");
    }
    throw new PublishError("Mastodon is still processing the video. Try again shortly.", { retryable: true });
  }
  return media.id;
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const instance = account.meta.instance as string;
  if (!instance) throw new PublishError("This Mastodon account is missing its server. Reconnect it.", { reconnect: true });

  const limits = await instanceLimits(instance);
  if (statusLength(input.text) > limits.maxChars) {
    throw new PublishError(`${new URL(instance).host} allows ${limits.maxChars} characters per post.`);
  }
  if (input.media.length > limits.maxMedia) {
    throw new PublishError(`${new URL(instance).host} allows ${limits.maxMedia} attachments per post.`);
  }

  const mediaIds: string[] = [];
  for (const m of input.media) {
    mediaIds.push(await uploadMedia(instance, account.accessToken, m.url, m.type, m.type === "video" ? limits.videoBytes : limits.imageBytes));
  }

  const res = await request(`${instance}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ status: input.text, media_ids: mediaIds, visibility: "public" }),
  });
  const status = await json<{ id: string; url: string }>(res, "Mastodon");
  return { externalId: status.id, url: status.url };
}

export const mastodon: Provider = {
  key: "mastodon",
  env: [],
  authorize,
  exchange,
  publish,
};
