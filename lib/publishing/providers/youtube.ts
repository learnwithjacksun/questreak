import { toTitle } from "../text";
import { env, form, json, request } from "../http";
import { remoteSize, videoMime } from "../media";
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
 * YouTube Data API v3 (resumable upload). Uses the same Google Cloud OAuth client as sign-in.
 * Note: videos.insert costs 1,600 quota units of the default 10,000/day (about 6 uploads), and
 * uploads from an unaudited API project are locked to private until the project passes
 * YouTube's API compliance audit.
 */

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: ctx.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // needed to get a refresh token every time
    include_granted_scopes: "true",
    state: ctx.state,
  }).toString();
  return url.toString();
}

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const tokenRes = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: form({
      code: ctx.code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: ctx.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = await json<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(tokenRes, "Google");

  const chRes = await request("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const channels = await json<{ items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } } }[] }>(
    chRes,
    "YouTube",
  );
  if (!channels.items?.length) {
    throw new PublishError("No YouTube channel was found for that Google account. Create a channel first, then connect again.");
  }

  return channels.items.map((c) => ({
    platform: "youtube" as const,
    externalId: c.id,
    handle: c.snippet.customUrl ?? c.id,
    displayName: c.snippet.title,
    avatar: c.snippet.thumbnails?.default?.url,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: token.scope?.split(" ") ?? SCOPES,
    meta: { channelId: c.id },
  }));
}

async function refresh(account: AccountCtx): Promise<TokenSet> {
  if (!account.refreshToken) throw new PublishError("Your Google connection expired. Reconnect the channel.", { reconnect: true });
  const res = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: form({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new PublishError("Google revoked access to this channel. Reconnect it to keep posting.", { reconnect: true });
  }
  const body = await json<{ access_token: string; expires_in: number }>(res, "Google");
  return { accessToken: body.access_token, refreshToken: account.refreshToken, expiresAt: new Date(Date.now() + body.expires_in * 1000) };
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const video = input.media.find((m) => m.type === "video");
  if (!video) throw new PublishError("YouTube posts need a video.");

  const opts = input.options.youtube ?? {};
  const [firstLine, ...rest] = input.text.trim().split(/\r?\n/);
  const title = (opts.title?.trim() || toTitle(input.text, 100) || "Untitled video").slice(0, 100);
  const description = (opts.title?.trim() ? input.text.trim() : rest.join("\n").trim() || firstLine || "").slice(0, 5000);

  const size = await remoteSize(video.url);
  const mime = videoMime(video.url);

  // 1) Open a resumable session with the metadata.
  const startRes = await request(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(size),
        "X-Upload-Content-Type": mime,
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: "22" },
        status: { privacyStatus: opts.privacy ?? "public", selfDeclaredMadeForKids: false },
      }),
    },
  );
  if (!startRes.ok) await json(startRes, "YouTube");
  const location = startRes.headers.get("location");
  if (!location) throw new PublishError("YouTube didn't return an upload address.");

  // 2) Stream the file from storage straight into YouTube without holding it in memory.
  const src = await request(video.url, { timeoutMs: 600_000 });
  if (!src.ok || !src.body) throw new PublishError(`Couldn't read the video file (${src.status}).`);
  const upload = await request(location, {
    method: "PUT",
    headers: { "Content-Type": mime, "Content-Length": String(size) },
    body: src.body,
    // Required by Node's fetch when the body is a stream.
    // @ts-expect-error duplex isn't in the DOM lib typings yet
    duplex: "half",
    timeoutMs: 900_000,
  });
  const created = await json<{ id: string }>(upload, "YouTube");
  return { externalId: created.id, url: `https://www.youtube.com/watch?v=${created.id}` };
}

export const youtube: Provider = {
  key: "youtube",
  env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 5 * 60 * 1000,
};
