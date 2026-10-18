import { env, form, json, request, sleep } from "../http";
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

/** Threads API (a separate Meta product with its own app id, tokens and host). */

const API = "https://graph.threads.net/v1.0";
const SCOPES = ["threads_basic", "threads_content_publish"];
const DAY = 24 * 60 * 60 * 1000;

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL("https://threads.net/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: env("THREADS_APP_ID"),
    redirect_uri: ctx.redirectUri,
    scope: SCOPES.join(","),
    response_type: "code",
    state: ctx.state,
  }).toString();
  return url.toString();
}

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const shortRes = await request("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    body: form({
      client_id: env("THREADS_APP_ID"),
      client_secret: env("THREADS_APP_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: ctx.redirectUri,
      code: ctx.code,
    }),
  });
  const short = await json<{ access_token: string; user_id: string | number }>(shortRes, "Threads");

  const longRes = await request(
    `https://graph.threads.net/access_token?${new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: env("THREADS_APP_SECRET"),
      access_token: short.access_token,
    })}`,
  );
  const long = await json<{ access_token: string; expires_in: number }>(longRes, "Threads");

  const meRes = await request(
    `${API}/me?${new URLSearchParams({ fields: "id,username,name,threads_profile_picture_url", access_token: long.access_token })}`,
  );
  const me = await json<{ id: string; username: string; name?: string; threads_profile_picture_url?: string }>(meRes, "Threads");

  return [
    {
      platform: "threads",
      externalId: String(me.id),
      handle: me.username,
      displayName: me.name || me.username,
      avatar: me.threads_profile_picture_url,
      accessToken: long.access_token,
      expiresAt: new Date(Date.now() + long.expires_in * 1000),
      scopes: SCOPES,
    },
  ];
}

/** Long-lived tokens last 60 days and can be refreshed once they're at least a day old. */
async function refresh(account: AccountCtx): Promise<TokenSet> {
  const res = await request(
    `https://graph.threads.net/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: account.accessToken })}`,
  );
  const body = await json<{ access_token: string; expires_in: number }>(res, "Threads");
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + body.expires_in * 1000) };
}

async function waitForContainer(id: string, token: string, tries: number, delayMs: number) {
  for (let i = 0; i < tries; i++) {
    const res = await request(`${API}/${id}?${new URLSearchParams({ fields: "status,error_message", access_token: token })}`);
    const body = await json<{ status?: string; error_message?: string }>(res, "Threads");
    if (body.status === "FINISHED") return;
    if (body.status === "ERROR" || body.status === "EXPIRED") {
      throw new PublishError(`Threads couldn't process the media${body.error_message ? `: ${body.error_message}` : "."}`);
    }
    await sleep(delayMs);
  }
  throw new PublishError("Threads is still processing the media. Try again in a few minutes.", { retryable: true });
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const user = account.externalId;
  const text = input.text.trim();
  if (Array.from(text).length > 500) throw new PublishError("Threads posts are limited to 500 characters.");

  const create = async (body: Record<string, string | boolean | undefined>) => {
    const res = await request(`${API}/${user}/threads`, {
      method: "POST",
      body: form({ ...body, access_token: token }),
      timeoutMs: 60_000,
    });
    return (await json<{ id: string }>(res, "Threads")).id;
  };
  const item = (m: { url: string; type: "image" | "video" }) =>
    m.type === "image" ? { media_type: "IMAGE", image_url: m.url } : { media_type: "VIDEO", video_url: m.url };

  let container: string;
  const hasVideo = input.media.some((m) => m.type === "video");
  if (input.media.length === 0) {
    container = await create({ media_type: "TEXT", text });
  } else if (input.media.length === 1) {
    container = await create({ ...item(input.media[0]), text });
  } else {
    const children: string[] = [];
    for (const m of input.media.slice(0, 20)) {
      const id = await create({ ...item(m), is_carousel_item: true });
      await waitForContainer(id, token, m.type === "video" ? 60 : 10, m.type === "video" ? 5_000 : 2_000);
      children.push(id);
    }
    container = await create({ media_type: "CAROUSEL", children: children.join(","), text });
  }

  // Threads recommends giving uploads a moment to process before publishing.
  if (input.media.length > 0) await waitForContainer(container, token, hasVideo ? 60 : 15, hasVideo ? 5_000 : 2_000);
  else await sleep(1_000);

  const pubRes = await request(`${API}/${user}/threads_publish`, {
    method: "POST",
    body: form({ creation_id: container, access_token: token }),
    timeoutMs: 60_000,
  });
  const { id } = await json<{ id: string }>(pubRes, "Threads");

  const linkRes = await request(`${API}/${id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`).catch(() => null);
  const permalink = linkRes?.ok ? (await linkRes.json().catch(() => ({})))?.permalink : undefined;
  return { externalId: id, url: permalink };
}

export const threads: Provider = {
  key: "threads",
  env: ["THREADS_APP_ID", "THREADS_APP_SECRET"],
  authorize,
  exchange,
  publish,
  refresh,
  refreshWindowMs: 15 * DAY,
};
