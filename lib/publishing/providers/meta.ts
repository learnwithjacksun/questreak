import { jpegVariant } from "../media";
import { env, form, json, request, sleep } from "../http";
import { firstUrl, hashtags } from "../text";
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
 * Facebook Pages + Instagram (Instagram API with Facebook Login). One sign-in discovers every
 * Page the user manages and any Instagram professional account linked to it. Page access tokens
 * derived from a long-lived user token do not expire.
 */

const version = () => process.env.META_GRAPH_VERSION || "v25.0";
const graph = () => `https://graph.facebook.com/${version()}`;

export const META_SCOPES = (
  process.env.META_SCOPES ||
  [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_read_user_engagement",
    "publish_video",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(",")
).split(",");

const AUTH_CODES = [190, 102, 463, 467, 10, 200];

function authorize(ctx: AuthorizeCtx): string {
  const url = new URL(`https://www.facebook.com/${version()}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: env("META_APP_ID"),
    redirect_uri: ctx.redirectUri,
    state: ctx.state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  }).toString();
  return url.toString();
}

async function exchange(ctx: ExchangeCtx): Promise<ConnectedAccount[]> {
  const appId = env("META_APP_ID");
  const secret = env("META_APP_SECRET");

  const shortRes = await request(
    `${graph()}/oauth/access_token?${new URLSearchParams({ client_id: appId, redirect_uri: ctx.redirectUri, client_secret: secret, code: ctx.code })}`,
  );
  const short = await json<{ access_token: string }>(shortRes, "Facebook");

  const longRes = await request(
    `${graph()}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: short.access_token })}`,
  );
  const long = await json<{ access_token: string }>(longRes, "Facebook");

  const accounts: ConnectedAccount[] = [];
  let next: string | undefined = `${graph()}/me/accounts?${new URLSearchParams({
    fields: "id,name,username,access_token,picture.type(large){url},instagram_business_account{id,username,name,profile_picture_url}",
    limit: "100",
    access_token: long.access_token,
  })}`;

  while (next) {
    const res = await request(next);
    const page: any = await json(res, "Facebook"); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const p of page.data ?? []) {
      if (!p.access_token) continue;
      accounts.push({
        platform: "facebook",
        externalId: p.id,
        handle: p.username ?? p.name,
        displayName: p.name,
        avatar: p.picture?.data?.url,
        accessToken: p.access_token,
        scopes: META_SCOPES,
        meta: { pageId: p.id },
      });
      const ig = p.instagram_business_account;
      if (ig?.id) {
        accounts.push({
          platform: "instagram",
          externalId: ig.id,
          handle: ig.username ?? ig.id,
          displayName: ig.name ?? ig.username ?? "Instagram",
          avatar: ig.profile_picture_url,
          accessToken: p.access_token, // Instagram publishing uses the Page token
          scopes: META_SCOPES,
          meta: { pageId: p.id },
        });
      }
    }
    next = page.paging?.next;
  }

  if (accounts.length === 0) {
    throw new PublishError(
      "No Facebook Pages were found. Make sure you selected your Page during sign-in and that you can manage it.",
    );
  }
  return accounts;
}

// ---------------------------------------------------------------- Facebook

async function facebookPublish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const page = account.externalId;
  const images = input.media.filter((m) => m.type === "image");
  const video = input.media.find((m) => m.type === "video");
  const text = input.text.trim();

  const post = async (path: string, body: Record<string, string | number | boolean | undefined>) => {
    const res = await request(`${graph()}/${page}/${path}`, {
      method: "POST",
      body: form({ ...body, access_token: token }),
      timeoutMs: 120_000,
    });
    return json<any>(res, "Facebook", { authCodes: AUTH_CODES }); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  let id: string;
  if (video) {
    const r = await post("videos", { file_url: video.url, description: text });
    id = r.id;
  } else if (images.length === 1) {
    const r = await post("photos", { url: images[0].url, caption: text, published: true });
    id = r.post_id ?? r.id;
  } else if (images.length > 1) {
    // Upload each photo unpublished, then attach them all to one feed post.
    const ids: string[] = [];
    for (const img of images) ids.push((await post("photos", { url: img.url, published: false })).id);
    const body: Record<string, string | undefined> = { message: text };
    ids.forEach((fbid, i) => (body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: fbid })));
    id = (await post("feed", body)).id;
  } else {
    id = (await post("feed", { message: text, link: firstUrl(text) })).id;
  }
  return { externalId: id, url: `https://www.facebook.com/${id}` };
}

// --------------------------------------------------------------- Instagram

async function waitForContainer(id: string, token: string, opts: { tries?: number; delayMs?: number } = {}) {
  const { tries = 40, delayMs = 3_000 } = opts;
  for (let i = 0; i < tries; i++) {
    const res = await request(`${graph()}/${id}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`);
    const body = await json<{ status_code?: string; status?: string }>(res, "Instagram", { authCodes: AUTH_CODES });
    if (body.status_code === "FINISHED") return;
    if (body.status_code === "ERROR" || body.status_code === "EXPIRED") {
      throw new PublishError(`Instagram couldn't process the media${body.status ? `: ${body.status}` : "."}`);
    }
    await sleep(delayMs);
  }
  throw new PublishError("Instagram is still processing the media. Try again in a few minutes.", { retryable: true });
}

async function instagramPublish(account: AccountCtx, input: PublishInput): Promise<PublishResult> {
  const token = account.accessToken;
  const ig = account.externalId;
  const caption = input.text.trim();

  if (input.media.length === 0) throw new PublishError("Instagram posts need a photo or video.");
  if (Array.from(caption).length > 2200) throw new PublishError("Instagram captions are limited to 2,200 characters.");
  if (hashtags(caption).length > 30) throw new PublishError("Instagram allows at most 30 hashtags per post.");

  const create = async (body: Record<string, string | boolean | undefined>) => {
    const res = await request(`${graph()}/${ig}/media`, {
      method: "POST",
      body: form({ ...body, access_token: token }),
      timeoutMs: 60_000,
    });
    return (await json<{ id: string }>(res, "Instagram", { authCodes: AUTH_CODES })).id;
  };
  const mediaParams = (m: { url: string; type: "image" | "video" }) =>
    m.type === "image"
      ? { image_url: jpegVariant(m.url, { width: 1440 }) } // Instagram only accepts JPEG
      : { video_url: m.url };

  let container: string;
  if (input.media.length === 1) {
    const m = input.media[0];
    container = await create({ ...mediaParams(m), ...(m.type === "video" ? { media_type: "REELS" } : {}), caption });
  } else {
    const children: string[] = [];
    for (const m of input.media.slice(0, 10)) {
      const id = await create({ ...mediaParams(m), ...(m.type === "video" ? { media_type: "VIDEO" } : {}), is_carousel_item: true });
      await waitForContainer(id, token, { tries: m.type === "video" ? 60 : 15 });
      children.push(id);
    }
    container = await create({ media_type: "CAROUSEL", children: children.join(","), caption });
  }

  const hasVideo = input.media.some((m) => m.type === "video");
  await waitForContainer(container, token, { tries: hasVideo ? 60 : 15, delayMs: hasVideo ? 5_000 : 2_000 });

  const pubRes = await request(`${graph()}/${ig}/media_publish`, {
    method: "POST",
    body: form({ creation_id: container, access_token: token }),
    timeoutMs: 60_000,
  });
  const { id } = await json<{ id: string }>(pubRes, "Instagram", { authCodes: AUTH_CODES });

  const linkRes = await request(`${graph()}/${id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`).catch(() => null);
  const permalink = linkRes?.ok ? (await linkRes.json().catch(() => ({})))?.permalink : undefined;
  return { externalId: id, url: permalink };
}

export const facebook: Provider = {
  key: "facebook",
  env: ["META_APP_ID", "META_APP_SECRET"],
  authorize,
  exchange,
  publish: facebookPublish,
};

export const instagram: Provider = {
  key: "instagram",
  env: ["META_APP_ID", "META_APP_SECRET"],
  connectVia: "facebook",
  publish: instagramPublish,
};

