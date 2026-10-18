import { blueskyFacets, graphemeLength } from "../text";
import { fetchBytes, jpegVariant } from "../media";
import { json, request, sleep } from "../http";
import {
  PublishError,
  type AccountCtx,
  type ConnectedAccount,
  type Provider,
  type PublishInput,
  type PublishResult,
} from "../types";

/**
 * Bluesky (AT Protocol). Connects with a handle + app password (the supported way for
 * third-party tools that don't run full AT Protocol OAuth). The app password is stored encrypted
 * in `accessTokenEnc`; each publish opens a short-lived session.
 */

export const DEFAULT_PDS = "https://bsky.social";
const VIDEO_SERVICE = "https://video.bsky.app";
const PUBLIC_API = "https://public.api.bsky.app";
const IMAGE_LIMIT = 976_560; // Bluesky's blob limit for images is 1,000,000 bytes; stay under.

type Session = {
  did: string;
  handle: string;
  accessJwt: string;
  didDoc?: { service?: { id: string; serviceEndpoint: string }[] };
};

export function normalizePds(input?: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return DEFAULT_PDS;
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new PublishError("The Bluesky server must use https.");
  }
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) && process.env.NODE_ENV === "production") {
    throw new PublishError("That server address isn't allowed.");
  }
  return url.origin;
}

async function createSession(pds: string, identifier: string, password: string): Promise<Session> {
  const res = await request(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (res.status === 401 || res.status === 400) {
    throw new PublishError("Bluesky rejected the handle or app password. Create a new app password and reconnect.", {
      reconnect: true,
    });
  }
  return json<Session>(res, "Bluesky");
}

/** Validate credentials and describe the account (used by the connect form). */
export async function connectBluesky(input: {
  identifier: string;
  appPassword: string;
  pds?: string;
}): Promise<ConnectedAccount> {
  const pds = normalizePds(input.pds);
  const identifier = input.identifier.trim().replace(/^@/, "");
  const session = await createSession(pds, identifier, input.appPassword.trim());

  const profileRes = await request(`${pds}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });
  const profile = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};

  return {
    platform: "bluesky",
    externalId: session.did,
    handle: session.handle,
    displayName: profile.displayName || session.handle,
    avatar: profile.avatar,
    accessToken: input.appPassword.trim(),
    meta: { pds },
  };
}

async function resolveMentions(text: string): Promise<Map<string, string>> {
  const handles = [...new Set([...text.matchAll(/(?:^|\s)@([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})/g)].map((m) => m[1]))];
  const out = new Map<string, string>();
  await Promise.all(
    handles.slice(0, 10).map(async (h) => {
      const res = await request(`${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(h)}`, {
        timeoutMs: 8_000,
      }).catch(() => null);
      if (res?.ok) {
        const body = await res.json().catch(() => null);
        if (body?.did) out.set(h, body.did);
      }
    }),
  );
  return out;
}

async function uploadBlob(pds: string, jwt: string, data: Buffer, mime: string) {
  const res = await request(`${pds}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": mime },
    body: new Uint8Array(data),
    timeoutMs: 60_000,
  });
  return (await json<{ blob: unknown }>(res, "Bluesky")).blob;
}

/** Bluesky rejects images over ~1 MB, so shrink through Cloudinary until it fits. */
async function uploadImage(pds: string, jwt: string, url: string) {
  const steps = [
    { width: 2000, quality: "auto:good" },
    { width: 1600, quality: "auto:eco" },
    { width: 1200, quality: "70" },
    { width: 900, quality: "60" },
  ];
  let last: Buffer | undefined;
  for (const step of steps) {
    const { data } = await fetchBytes(jpegVariant(url, step), { maxBytes: 30_000_000 });
    last = data;
    if (data.length <= IMAGE_LIMIT) return uploadBlob(pds, jwt, data, "image/jpeg");
  }
  throw new PublishError(`This image is still ${((last?.length ?? 0) / 1e6).toFixed(1)} MB after shrinking. Bluesky's limit is 1 MB.`);
}

async function uploadVideo(pds: string, session: Session, url: string) {
  const endpoint = session.didDoc?.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint ?? pds;
  const aud = `did:web:${new URL(endpoint).host}`;
  const exp = Math.floor(Date.now() / 1000) + 30 * 60;

  const authRes = await request(
    `${pds}/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent(aud)}&lxm=com.atproto.repo.uploadBlob&exp=${exp}`,
    { headers: { Authorization: `Bearer ${session.accessJwt}` } },
  );
  const { token } = await json<{ token: string }>(authRes, "Bluesky");

  const { data } = await fetchBytes(url, { maxBytes: 100_000_000 });
  const upRes = await request(
    `${VIDEO_SERVICE}/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(session.did)}&name=video.mp4`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
      body: new Uint8Array(data),
      timeoutMs: 180_000,
    },
  );
  // 409 means this exact video was uploaded before; the body still carries the job.
  const job: any = upRes.ok || upRes.status === 409 ? await upRes.json().catch(() => ({})) : await json(upRes, "Bluesky"); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (job.blob) return job.blob;

  for (let i = 0; i < 60; i++) {
    await sleep(2_000);
    const stRes = await request(`${VIDEO_SERVICE}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(job.jobId)}`);
    const st = (await json<any>(stRes, "Bluesky")).jobStatus; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (st?.state === "JOB_STATE_COMPLETED" && st.blob) return st.blob;
    if (st?.state === "JOB_STATE_FAILED") throw new PublishError(st.error || st.message || "Bluesky couldn't process the video.");
  }
  throw new PublishError("Bluesky is still processing the video. Try again in a few minutes.", { retryable: true });
}

async function publish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const pds = (account.meta.pds as string) || DEFAULT_PDS;
  const text = input.text.trim();
  if (graphemeLength(text) > 300) throw new PublishError("Bluesky posts are limited to 300 characters.");

  const session = await createSession(pds, account.externalId, account.accessToken);

  const images = input.media.filter((m) => m.type === "image");
  const video = input.media.find((m) => m.type === "video");

  let embed: unknown;
  if (video) {
    const blob = await uploadVideo(pds, session, video.url);
    embed = { $type: "app.bsky.embed.video", video: blob };
  } else if (images.length) {
    const uploaded = [];
    for (const img of images.slice(0, 4)) uploaded.push({ alt: "", image: await uploadImage(pds, session.accessJwt, img.url) });
    embed = { $type: "app.bsky.embed.images", images: uploaded };
  }

  const mentions = await resolveMentions(text);
  const facets = blueskyFacets(text, (h) => mentions.get(h));

  const res = await request(`${pds}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
        ...(facets.length ? { facets } : {}),
        ...(embed ? { embed } : {}),
      },
    }),
  });
  const body = await json<{ uri: string }>(res, "Bluesky");
  const rkey = body.uri.split("/").pop();
  return { externalId: body.uri, url: `https://bsky.app/profile/${session.handle}/post/${rkey}` };
}

export const bluesky: Provider = {
  key: "bluesky",
  env: [],
  publish,
};
