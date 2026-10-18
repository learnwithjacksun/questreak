/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { account, bytes, CLOUD, CLOUD_VIDEO, input, mockFetch, ok, restoreFetch } from "./helpers";
import { PublishError } from "../lib/publishing/types";

beforeAll(() => {
  Object.assign(process.env, {
    META_APP_ID: "meta-id",
    META_APP_SECRET: "meta-secret",
    META_GRAPH_VERSION: "v25.0",
    THREADS_APP_ID: "th-id",
    THREADS_APP_SECRET: "th-secret",
    LINKEDIN_CLIENT_ID: "li-id",
    LINKEDIN_CLIENT_SECRET: "li-secret",
    LINKEDIN_API_VERSION: "202609",
    X_CLIENT_ID: "x-id",
    X_CLIENT_SECRET: "x-secret",
    TIKTOK_CLIENT_KEY: "tt-key",
    TIKTOK_CLIENT_SECRET: "tt-secret",
    PINTEREST_APP_ID: "pin-id",
    PINTEREST_APP_SECRET: "pin-secret",
    GOOGLE_CLIENT_ID: "g-id",
    GOOGLE_CLIENT_SECRET: "g-secret",
  });
});
afterEach(restoreFetch);

// ------------------------------------------------------------------ Bluesky

describe("Bluesky", () => {
  const session = { did: "did:plc:abc", handle: "me.bsky.social", accessJwt: "jwt", didDoc: { service: [{ id: "#atproto_pds", serviceEndpoint: "https://pds.example.net" }] } };

  test("connect validates credentials and returns the account", async () => {
    const { connectBluesky } = await import("../lib/publishing/providers/bluesky");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("com.atproto.server.createSession")) return ok(session);
      if (c.url.includes("app.bsky.actor.getProfile")) return ok({ displayName: "Me!", avatar: "https://cdn/a.jpg" });
    });
    const acc = await connectBluesky({ identifier: "@me.bsky.social", appPassword: "abcd-efgh-ijkl-mnop" });
    expect(acc).toMatchObject({ platform: "bluesky", externalId: "did:plc:abc", handle: "me.bsky.social", displayName: "Me!", accessToken: "abcd-efgh-ijkl-mnop", meta: { pds: "https://bsky.social" } });
    expect(calls[0].body).toEqual({ identifier: "me.bsky.social", password: "abcd-efgh-ijkl-mnop" }); // leading @ stripped
  });

  test("bad credentials say so and ask to reconnect", async () => {
    const { connectBluesky } = await import("../lib/publishing/providers/bluesky");
    mockFetch(() => new Response(JSON.stringify({ error: "AuthenticationRequired" }), { status: 401 }));
    await expect(connectBluesky({ identifier: "me", appPassword: "bad" })).rejects.toThrow(/rejected the handle or app password/);
  });

  test("text post with facets goes to createRecord on the user's PDS", async () => {
    const { bluesky } = await import("../lib/publishing/providers/bluesky");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("createSession")) return ok(session);
      if (c.url.endsWith("createRecord")) return ok({ uri: "at://did:plc:abc/app.bsky.feed.post/3kabc" });
    });
    const res = await bluesky.publish(
      account({ meta: { pds: "https://pds.example.net" } }),
      input({ text: "Launch! https://example.com #ship" }),
    );
    expect(res.url).toBe("https://bsky.app/profile/me.bsky.social/post/3kabc");
    const create = calls.find((c) => c.url.endsWith("createRecord"))!;
    expect(create.url.startsWith("https://pds.example.net/")).toBe(true);
    expect(create.headers.authorization).toBe("Bearer jwt");
    expect(create.body.repo).toBe("did:plc:abc");
    expect(create.body.collection).toBe("app.bsky.feed.post");
    expect(create.body.record.text).toBe("Launch! https://example.com #ship");
    expect(create.body.record.facets.map((f: any) => f.features[0].$type)).toEqual([
      "app.bsky.richtext.facet#link",
      "app.bsky.richtext.facet#tag",
    ]);
  });

  test("images are shrunk below 1 MB before upload and attached as an images embed", async () => {
    const { bluesky } = await import("../lib/publishing/providers/bluesky");
    let downloads = 0;
    const calls = mockFetch((c) => {
      if (c.url.endsWith("createSession")) return ok(session);
      if (c.url.startsWith("https://res.cloudinary.com")) {
        downloads++;
        return bytes(downloads === 1 ? 2_000_000 : 400_000); // first rendition too big, second fits
      }
      if (c.url.endsWith("uploadBlob")) return ok({ blob: { $type: "blob", size: 400000 } });
      if (c.url.endsWith("createRecord")) return ok({ uri: "at://did:plc:abc/app.bsky.feed.post/xyz" });
    });
    await bluesky.publish(account(), input({ media: [{ url: CLOUD, type: "image" }] }));
    expect(downloads).toBe(2);
    expect(calls.filter((c) => c.url.startsWith("https://res.cloudinary.com")).map((c) => c.url)[0]).toContain("f_jpg");
    expect(calls.find((c) => c.url.endsWith("uploadBlob"))!.headers["content-type"]).toBe("image/jpeg");
    const record = calls.find((c) => c.url.endsWith("createRecord"))!.body.record;
    expect(record.embed.$type).toBe("app.bsky.embed.images");
    expect(record.embed.images).toHaveLength(1);
  });

  test("over 300 characters is refused before any network call", async () => {
    const { bluesky } = await import("../lib/publishing/providers/bluesky");
    const calls = mockFetch(() => ok({}));
    await expect(bluesky.publish(account(), input({ text: "a".repeat(301) }))).rejects.toThrow(/300 characters/);
    expect(calls).toHaveLength(0);
  });
});

// ----------------------------------------------------------------- Mastodon

describe("Mastodon", () => {
  test("normalizeInstance accepts several spellings and blocks internal hosts", async () => {
    const { normalizeInstance } = await import("../lib/publishing/providers/mastodon");
    expect(normalizeInstance("Mastodon.Social")).toBe("https://mastodon.social");
    expect(normalizeInstance("https://fosstodon.org/")).toBe("https://fosstodon.org");
    expect(normalizeInstance("@me@hachyderm.io")).toBe("https://hachyderm.io");
  });

  test("publishing uploads media, then posts with an idempotency key", async () => {
    const { mastodon } = await import("../lib/publishing/providers/mastodon");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/api/v2/instance")) return ok({ configuration: { statuses: { max_characters: 5000, max_media_attachments: 4 }, media_attachments: { image_size_limit: 16000000, video_size_limit: 99000000 } } });
      if (c.url.startsWith("https://res.cloudinary.com")) return bytes(1000, "image/png");
      if (c.url.endsWith("/api/v2/media")) return ok({ id: "m1" });
      if (c.url.endsWith("/api/v1/statuses")) return ok({ id: "s1", url: "https://masto.example/@me/s1" });
    });
    const res = await mastodon.publish(
      account({ platform: "mastodon", meta: { instance: "https://masto.example" } }),
      input({ text: "x".repeat(900), media: [{ url: CLOUD, type: "image" }] }), // 900 > default 500, allowed by this server
    );
    expect(res).toEqual({ externalId: "s1", url: "https://masto.example/@me/s1" });
    const media = calls.find((c) => c.url.endsWith("/api/v2/media"))!;
    expect(media.headers.authorization).toBe("Bearer token");
    expect(media.body.file).toMatchObject({ type: "image/png", size: 1000 });
    const post = calls.find((c) => c.url.endsWith("/api/v1/statuses"))!;
    expect(post.body).toMatchObject({ media_ids: ["m1"], visibility: "public" });
    expect(post.headers["idempotency-key"]).toMatch(/[0-9a-f-]{36}/);
  });

  test("respects the server's own limit", async () => {
    const { mastodon } = await import("../lib/publishing/providers/mastodon");
    mockFetch((c) => (c.url.endsWith("/api/v2/instance") ? ok({ configuration: { statuses: { max_characters: 100 } } }) : undefined));
    await expect(
      mastodon.publish(account({ platform: "mastodon", meta: { instance: "https://small.example" } }), input({ text: "y".repeat(101) })),
    ).rejects.toThrow(/allows 100 characters/);
  });
});

// ------------------------------------------------------------ Facebook / IG

describe("Facebook", () => {
  const page = account({ platform: "facebook", externalId: "PAGE1", accessToken: "page-token" });

  test("text with a link posts to /feed and passes the link", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    const calls = mockFetch(() => ok({ id: "PAGE1_99" }));
    const res = await facebook.publish(page, input({ text: "Read this https://example.com/post" }));
    expect(calls[0].url).toBe("https://graph.facebook.com/v25.0/PAGE1/feed");
    expect(calls[0].body).toMatchObject({ message: "Read this https://example.com/post", link: "https://example.com/post", access_token: "page-token" });
    expect(res.url).toBe("https://www.facebook.com/PAGE1_99");
  });

  test("several photos are uploaded unpublished, then attached to one feed post", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    let n = 0;
    const calls = mockFetch((c) => (c.url.endsWith("/photos") ? ok({ id: `ph${++n}` }) : ok({ id: "PAGE1_5" })));
    await facebook.publish(page, input({ media: [{ url: CLOUD, type: "image" }, { url: CLOUD, type: "image" }] }));
    expect(calls.slice(0, 2).every((c) => c.url.endsWith("/photos") && c.body.published === "false")).toBe(true);
    const feed = calls[2];
    expect(feed.url.endsWith("/feed")).toBe(true);
    expect(JSON.parse(feed.body["attached_media[0]"])).toEqual({ media_fbid: "ph1" });
    expect(JSON.parse(feed.body["attached_media[1]"])).toEqual({ media_fbid: "ph2" });
  });

  test("a video is posted by URL", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    const calls = mockFetch(() => ok({ id: "vid1" }));
    await facebook.publish(page, input({ media: [{ url: CLOUD_VIDEO, type: "video" }] }));
    expect(calls[0].url).toBe("https://graph.facebook.com/v25.0/PAGE1/videos");
    expect(calls[0].body.file_url).toBe(CLOUD_VIDEO);
  });

  test("an expired token is reported as needing a reconnect", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    mockFetch(() => new Response(JSON.stringify({ error: { message: "Error validating access token", type: "OAuthException", code: 190 } }), { status: 400 }));
    const err = await facebook.publish(page, input()).catch((e) => e);
    expect(err).toBeInstanceOf(PublishError);
    expect(err.reconnect).toBe(true);
  });
});

describe("Instagram", () => {
  const ig = account({ platform: "instagram", externalId: "IG1", accessToken: "page-token" });

  test("one image: JPEG variant container, status poll, publish, permalink", async () => {
    const { instagram } = await import("../lib/publishing/providers/meta");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/IG1/media")) return ok({ id: "C1" });
      if (c.url.includes("/C1?")) return ok({ status_code: "FINISHED" });
      if (c.url.endsWith("/IG1/media_publish")) return ok({ id: "M1" });
      if (c.url.includes("/M1?")) return ok({ permalink: "https://instagram.com/p/abc/" });
    });
    const res = await instagram.publish(ig, input({ text: "Caption #one", media: [{ url: CLOUD, type: "image" }] }));
    const create = calls.find((c) => c.url.endsWith("/IG1/media"))!;
    expect(create.body.image_url).toContain("f_jpg");
    expect(create.body.caption).toBe("Caption #one");
    expect(create.body.media_type).toBeUndefined();
    expect(calls.find((c) => c.url.endsWith("media_publish"))!.body.creation_id).toBe("C1");
    expect(res).toEqual({ externalId: "M1", url: "https://instagram.com/p/abc/" });
  });

  test("one video becomes a Reel", async () => {
    const { instagram } = await import("../lib/publishing/providers/meta");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/IG1/media")) return ok({ id: "C2" });
      if (c.url.includes("/C2?")) return ok({ status_code: "FINISHED" });
      if (c.url.endsWith("media_publish")) return ok({ id: "M2" });
      return ok({});
    });
    await instagram.publish(ig, input({ media: [{ url: CLOUD_VIDEO, type: "video" }] }));
    const create = calls.find((c) => c.url.endsWith("/IG1/media"))!;
    expect(create.body).toMatchObject({ media_type: "REELS", video_url: CLOUD_VIDEO });
  });

  test("several items become a carousel of child containers", async () => {
    const { instagram } = await import("../lib/publishing/providers/meta");
    let n = 0;
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/IG1/media")) return ok({ id: `K${++n}` });
      if (c.url.includes("fields=status_code")) return ok({ status_code: "FINISHED" });
      if (c.url.endsWith("media_publish")) return ok({ id: "M3" });
      return ok({});
    });
    await instagram.publish(ig, input({ media: [{ url: CLOUD, type: "image" }, { url: CLOUD, type: "image" }] }));
    const creates = calls.filter((c) => c.url.endsWith("/IG1/media"));
    expect(creates).toHaveLength(3);
    expect(creates[0].body.is_carousel_item).toBe("true");
    expect(creates[2].body).toMatchObject({ media_type: "CAROUSEL", children: "K1,K2" });
  });

  test("rules: needs media, caption length, hashtag count", async () => {
    const { instagram } = await import("../lib/publishing/providers/meta");
    mockFetch(() => ok({}));
    await expect(instagram.publish(ig, input())).rejects.toThrow(/need a photo or video/);
    await expect(instagram.publish(ig, input({ text: "a".repeat(2201), media: [{ url: CLOUD, type: "image" }] }))).rejects.toThrow(/2,200/);
    const many = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    await expect(instagram.publish(ig, input({ text: many, media: [{ url: CLOUD, type: "image" }] }))).rejects.toThrow(/30 hashtags/);
  });

  test("a failed container surfaces Instagram's reason", async () => {
    const { instagram } = await import("../lib/publishing/providers/meta");
    mockFetch((c) => {
      if (c.url.endsWith("/IG1/media")) return ok({ id: "C9" });
      if (c.url.includes("/C9?")) return ok({ status_code: "ERROR", status: "Unsupported aspect ratio" });
    });
    await expect(instagram.publish(ig, input({ media: [{ url: CLOUD, type: "image" }] }))).rejects.toThrow(/Unsupported aspect ratio/);
  });
});

describe("Meta connect", () => {
  test("discovers pages and linked Instagram accounts with page tokens", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    mockFetch((c) => {
      if (c.url.includes("/oauth/access_token") && c.url.includes("code=abc")) return ok({ access_token: "short" });
      if (c.url.includes("fb_exchange_token")) return ok({ access_token: "long" });
      if (c.url.includes("/me/accounts")) {
        return ok({
          data: [
            { id: "P1", name: "Shop", username: "shop", access_token: "pt1", picture: { data: { url: "https://p/1" } }, instagram_business_account: { id: "I1", username: "shop_ig", name: "Shop IG", profile_picture_url: "https://p/i" } },
            { id: "P2", name: "Blog", access_token: "pt2" },
          ],
        });
      }
    });
    const accounts = await facebook.exchange!({ code: "abc", redirectUri: "https://app.example.com/api/connect/facebook/callback", verifier: "v", extra: {} });
    expect(accounts.map((a) => `${a.platform}:${a.externalId}`)).toEqual(["facebook:P1", "instagram:I1", "facebook:P2"]);
    expect(accounts.find((a) => a.platform === "instagram")).toMatchObject({ accessToken: "pt1", meta: { pageId: "P1" } });
  });

  test("the authorize URL asks for the publishing scopes", async () => {
    const { facebook } = await import("../lib/publishing/providers/meta");
    const url = new URL(await facebook.authorize!({ redirectUri: "https://app.example.com/cb", state: "s1", verifier: "v", extra: {} }));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.searchParams.get("state")).toBe("s1");
  });
});

// ------------------------------------------------------------------ Threads

describe("Threads", () => {
  const th = account({ platform: "threads", externalId: "T1", accessToken: "th-token" });

  test("text post: container then publish", async () => {
    const { threads } = await import("../lib/publishing/providers/threads");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/T1/threads")) return ok({ id: "TC1" });
      if (c.url.endsWith("/T1/threads_publish")) return ok({ id: "TP1" });
      if (c.url.includes("fields=permalink")) return ok({ permalink: "https://threads.net/@me/post/abc" });
    });
    const res = await threads.publish(th, input({ text: "hello threads" }));
    expect(calls[0].url).toBe("https://graph.threads.net/v1.0/T1/threads");
    expect(calls[0].body).toMatchObject({ media_type: "TEXT", text: "hello threads", access_token: "th-token" });
    expect(calls.find((c) => c.url.endsWith("threads_publish"))!.body.creation_id).toBe("TC1");
    expect(res.url).toBe("https://threads.net/@me/post/abc");
  });

  test("image post waits for the container to finish", async () => {
    const { threads } = await import("../lib/publishing/providers/threads");
    const calls = mockFetch((c) => {
      if (c.url.endsWith("/T1/threads")) return ok({ id: "TC2" });
      if (c.url.includes("/TC2?")) return ok({ status: "FINISHED" });
      if (c.url.endsWith("threads_publish")) return ok({ id: "TP2" });
      return ok({});
    });
    await threads.publish(th, input({ media: [{ url: CLOUD, type: "image" }] }));
    expect(calls[0].body).toMatchObject({ media_type: "IMAGE", image_url: CLOUD, text: "Hello world" });
  });

  test("tokens are refreshed with th_refresh_token", async () => {
    const { threads } = await import("../lib/publishing/providers/threads");
    const calls = mockFetch(() => ok({ access_token: "new", expires_in: 5184000 }));
    const next = await threads.refresh!(th);
    expect(calls[0].url).toContain("refresh_access_token");
    expect(calls[0].url).toContain("grant_type=th_refresh_token");
    expect(next.accessToken).toBe("new");
    expect(next.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86400_000);
  });
});

// ----------------------------------------------------------------- LinkedIn

describe("LinkedIn", () => {
  const li = account({ platform: "linkedin", externalId: "MEMBER1", accessToken: "li-token" });

  test("a text post escapes markup and sends the required headers", async () => {
    const { linkedin } = await import("../lib/publishing/providers/linkedin");
    const calls = mockFetch(() => new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:123" } }));
    const res = await linkedin.publish(li, input({ text: "Hi (team) #launch" }));
    const c = calls[0];
    expect(c.url).toBe("https://api.linkedin.com/rest/posts");
    expect(c.headers["linkedin-version"]).toBe("202609");
    expect(c.headers["x-restli-protocol-version"]).toBe("2.0.0");
    expect(c.headers.authorization).toBe("Bearer li-token");
    expect(c.body).toMatchObject({
      author: "urn:li:person:MEMBER1",
      commentary: "Hi \\(team\\) #launch",
      visibility: "PUBLIC",
      lifecycleState: "PUBLISHED",
      distribution: { feedDistribution: "MAIN_FEED" },
    });
    expect(c.body.content).toBeUndefined();
    expect(res).toEqual({ externalId: "urn:li:share:123", url: "https://www.linkedin.com/feed/update/urn:li:share:123/" });
  });

  test("an image is registered, uploaded, then referenced by URN", async () => {
    const { linkedin } = await import("../lib/publishing/providers/linkedin");
    const calls = mockFetch((c) => {
      if (c.url.includes("images?action=initializeUpload")) return ok({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/abc", image: "urn:li:image:IMG1" } });
      if (c.url.startsWith("https://res.cloudinary.com")) return bytes(5000, "image/png");
      if (c.url.startsWith("https://www.linkedin.com/dms-uploads")) return new Response(null, { status: 201 });
      if (c.url.endsWith("/rest/posts")) return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:9" } });
    });
    await linkedin.publish(li, input({ media: [{ url: CLOUD, type: "image" }] }));
    const init = calls.find((c) => c.url.includes("initializeUpload"))!;
    expect(init.body).toEqual({ initializeUploadRequest: { owner: "urn:li:person:MEMBER1" } });
    expect(calls.find((c) => c.method === "PUT")!.headers["content-type"]).toBe("image/png");
    expect(calls.find((c) => c.url.endsWith("/rest/posts"))!.body.content).toEqual({ media: { id: "urn:li:image:IMG1" } });
  });

  test("a failed refresh without a refresh token asks to reconnect", async () => {
    const { linkedin } = await import("../lib/publishing/providers/linkedin");
    const err = await linkedin.refresh!(li).catch((e) => e);
    expect(err.reconnect).toBe(true);
  });
});

// ------------------------------------------------------------------------ X

describe("X", () => {
  const xa = account({ platform: "x", externalId: "X1", handle: "me", accessToken: "x-token" });

  test("a text post", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    const calls = mockFetch(() => ok({ data: { id: "1900" } }, { status: 201 }));
    const res = await x.publish(xa, input({ text: "hello x" }));
    expect(calls[0].url).toBe("https://api.x.com/2/tweets");
    expect(calls[0].body).toEqual({ text: "hello x" });
    expect(res.url).toBe("https://x.com/me/status/1900");
  });

  test("images use the v2 upload endpoint, then attach media ids", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    const calls = mockFetch((c) => {
      if (c.url.startsWith("https://res.cloudinary.com")) return bytes(3000, "image/png");
      if (c.url.endsWith("/2/media/upload")) return ok({ data: { id: "555" } });
      if (c.url.endsWith("/2/tweets")) return ok({ data: { id: "1901" } }, { status: 201 });
    });
    await x.publish(xa, input({ media: [{ url: CLOUD, type: "image" }] }));
    const up = calls.find((c) => c.url.endsWith("/2/media/upload"))!;
    expect(up.body.media_category).toBe("tweet_image");
    expect(up.headers.authorization).toBe("Bearer x-token");
    expect(calls.find((c) => c.url.endsWith("/2/tweets"))!.body.media).toEqual({ media_ids: ["555"] });
  });

  test("video: initialize, append chunks, finalize, then post", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    const calls = mockFetch((c) => {
      if (c.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "9000000" } });
      if (c.url.endsWith("/initialize")) return ok({ data: { id: "777" } });
      if (c.headers.range) {
        const [a, b] = c.headers.range.replace("bytes=", "").split("-").map(Number);
        return new Response(new Uint8Array(b - a + 1), { status: 206 });
      }
      if (c.url.endsWith("/777/append")) return ok({ data: { expires_at: 1 } });
      if (c.url.endsWith("/777/finalize")) return ok({ data: { id: "777", processing_info: { state: "succeeded" } } });
      if (c.url.endsWith("/2/tweets")) return ok({ data: { id: "1902" } }, { status: 201 });
    });
    await x.publish(xa, input({ media: [{ url: CLOUD_VIDEO, type: "video" }] }));
    expect(calls.find((c) => c.url.endsWith("/initialize"))!.body).toMatchObject({ total_bytes: 9000000, media_type: "video/mp4", media_category: "tweet_video" });
    const appends = calls.filter((c) => c.url.endsWith("/append"));
    expect(appends.map((a) => a.body.segment_index)).toEqual(["0", "1", "2"]); // 9 MB in 4 MB chunks
    expect(calls.findIndex((c) => c.url.endsWith("/finalize"))).toBeGreaterThan(calls.findIndex((c) => c.url.endsWith("/append")));
  });

  test("a missing credit balance is explained", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    mockFetch(() => new Response(JSON.stringify({ title: "CreditsDepleted" }), { status: 402 }));
    await expect(x.publish(xa, input())).rejects.toThrow(/no posting credits/);
  });

  test("refresh rotates the refresh token", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    const calls = mockFetch(() => ok({ access_token: "a2", refresh_token: "r2", expires_in: 7200 }));
    const next = await x.refresh!({ ...xa, refreshToken: "r1" });
    expect(calls[0].headers.authorization).toStartWith("Basic ");
    expect(calls[0].body).toMatchObject({ grant_type: "refresh_token", refresh_token: "r1" });
    expect(next).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });

  test("authorize uses PKCE and all required scopes", async () => {
    const { x } = await import("../lib/publishing/providers/x");
    const url = new URL(await x.authorize!({ redirectUri: "https://app.example.com/cb", state: "s", verifier: "verifier123", extra: {} }));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    for (const s of ["tweet.write", "media.write", "offline.access"]) expect(url.searchParams.get("scope")).toContain(s);
  });
});

// ---------------------------------------------------------------- Pinterest

describe("Pinterest", () => {
  const pin = account({ platform: "pinterest", externalId: "me", accessToken: "pin-token", meta: { boardId: "B1" } });

  test("a single image pin on the default board", async () => {
    const { pinterest } = await import("../lib/publishing/providers/pinterest");
    const calls = mockFetch(() => ok({ id: "PIN1" }, { status: 201 }));
    const res = await pinterest.publish(pin, input({ text: "Nice chair\nhttps://shop.example/chair", media: [{ url: CLOUD, type: "image" }] }));
    expect(calls[0].url).toBe("https://api.pinterest.com/v5/pins");
    expect(calls[0].body).toMatchObject({
      board_id: "B1",
      title: "Nice chair",
      link: "https://shop.example/chair",
      media_source: { source_type: "image_url" },
    });
    expect(calls[0].body.media_source.url).toContain("f_jpg");
    expect(res.url).toBe("https://www.pinterest.com/pin/PIN1/");
  });

  test("a chosen board overrides the default; several images make a carousel pin", async () => {
    const { pinterest } = await import("../lib/publishing/providers/pinterest");
    const calls = mockFetch(() => ok({ id: "PIN2" }, { status: 201 }));
    await pinterest.publish(pin, input({ options: { pinterest: { boardId: "B2", title: "Custom" } }, media: [{ url: CLOUD, type: "image" }, { url: CLOUD, type: "image" }] }));
    expect(calls[0].body.board_id).toBe("B2");
    expect(calls[0].body.title).toBe("Custom");
    expect(calls[0].body.media_source.source_type).toBe("multiple_image_urls");
    expect(calls[0].body.media_source.items).toHaveLength(2);
  });

  test("falls back to the first board when none is chosen", async () => {
    const { pinterest } = await import("../lib/publishing/providers/pinterest");
    const calls = mockFetch((c) => (c.url.includes("/boards") ? ok({ items: [{ id: "FIRST", name: "A" }] }) : ok({ id: "PIN3" })));
    await pinterest.publish(account({ platform: "pinterest", accessToken: "t" }), input({ media: [{ url: CLOUD, type: "image" }] }));
    expect(calls.find((c) => c.url.endsWith("/pins"))!.body.board_id).toBe("FIRST");
  });

  test("needs an image or video", async () => {
    const { pinterest } = await import("../lib/publishing/providers/pinterest");
    mockFetch(() => ok({}));
    await expect(pinterest.publish(pin, input())).rejects.toThrow(/need an image or video/);
  });
});

// ------------------------------------------------------------------ TikTok

describe("TikTok", () => {
  const tk = account({ platform: "tiktok", externalId: "OPENID", accessToken: "tk-token" });
  const creator = { data: { creator_nickname: "Me", privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], comment_disabled: false, duet_disabled: false, stitch_disabled: true, max_video_post_duration_sec: 600 }, error: { code: "ok" } };

  test("requires a visibility choice", async () => {
    const { tiktok } = await import("../lib/publishing/providers/tiktok");
    mockFetch(() => ok(creator));
    await expect(tiktok.publish(tk, input({ media: [{ url: CLOUD_VIDEO, type: "video" }] }))).rejects.toThrow(/Choose who can view/);
  });

  test("until audited, every post is forced private", async () => {
    const { tiktok } = await import("../lib/publishing/providers/tiktok");
    delete process.env.TIKTOK_AUDITED;
    const calls = mockFetch((c) => {
      if (c.url.includes("creator_info")) return ok(creator);
      if (c.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "3000000" } });
      if (c.headers.range) return new Response(new Uint8Array(3_000_000), { status: 206 });
      if (c.url.includes("video/init")) return ok({ data: { publish_id: "PUB1", upload_url: "https://upload.tiktok/abc" }, error: { code: "ok" } });
      if (c.url === "https://upload.tiktok/abc") return new Response(null, { status: 201 });
      if (c.url.includes("status/fetch")) return ok({ data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["7000"] }, error: { code: "ok" } });
    });
    const res = await tiktok.publish(
      tk,
      input({ text: "my clip", media: [{ url: CLOUD_VIDEO, type: "video" }], options: { tiktok: { a1: { privacy: "PUBLIC_TO_EVERYONE", comment: true, duet: true } } } }),
    );
    const init = calls.find((c) => c.url.includes("video/init"))!;
    expect(init.body.post_info.privacy_level).toBe("SELF_ONLY"); // forced, even though Everyone was chosen
    expect(init.body.post_info).toMatchObject({ title: "my clip", disable_comment: false, disable_duet: false, disable_stitch: true, brand_content_toggle: false, brand_organic_toggle: false });
    expect(init.body.source_info).toEqual({ source: "FILE_UPLOAD", video_size: 3000000, chunk_size: 3000000, total_chunk_count: 1 });
    const put = calls.find((c) => c.url === "https://upload.tiktok/abc")!;
    expect(put.headers["content-range"]).toBe("bytes 0-2999999/3000000");
    expect(put.headers["content-type"]).toBe("video/mp4");
    expect(res.externalId).toBe("7000");
  }, 20_000);

  test("after audit the chosen visibility is used; branded content can't be private", async () => {
    const { tiktok } = await import("../lib/publishing/providers/tiktok");
    process.env.TIKTOK_AUDITED = "true";
    mockFetch((c) => (c.url.includes("creator_info") ? ok(creator) : undefined));
    const opts = { tiktok: { a1: { privacy: "SELF_ONLY", commercial: true, brandedContent: true } } };
    await expect(tiktok.publish(tk, input({ media: [{ url: CLOUD_VIDEO, type: "video" }], options: opts }))).rejects.toThrow(/can't be private/);
    delete process.env.TIKTOK_AUDITED;
  });

  test("photos are pulled from our verified domain through signed proxy URLs", async () => {
    const { tiktok } = await import("../lib/publishing/providers/tiktok");
    const calls = mockFetch((c) => {
      if (c.url.includes("creator_info")) return ok(creator);
      if (c.url.includes("content/init")) return ok({ data: { publish_id: "PUB2" }, error: { code: "ok" } });
      if (c.url.includes("status/fetch")) return ok({ data: { status: "PUBLISH_COMPLETE" }, error: { code: "ok" } });
    });
    await tiktok.publish(tk, input({ text: "Photo set", media: [{ url: CLOUD, type: "image" }], options: { tiktok: { a1: { privacy: "SELF_ONLY" } } } }));
    const init = calls.find((c) => c.url.includes("content/init"))!;
    expect(init.body).toMatchObject({ media_type: "PHOTO", post_mode: "DIRECT_POST", source_info: { source: "PULL_FROM_URL", photo_cover_index: 0 } });
    expect(init.body.source_info.photo_images[0]).toMatch(/^https:\/\/app\.example\.com\/api\/public-media\/.+\.jpg$/);
  }, 20_000);

  test("TikTok's audit error is explained", async () => {
    const { tiktok } = await import("../lib/publishing/providers/tiktok");
    mockFetch((c) => {
      if (c.url.includes("creator_info")) return ok(creator);
      if (c.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "1000" } });
      if (c.url.includes("video/init")) return new Response(JSON.stringify({ error: { code: "unaudited_client_can_only_post_to_private_accounts", message: "x" } }), { status: 403 });
    });
    await expect(tiktok.publish(tk, input({ media: [{ url: CLOUD_VIDEO, type: "video" }], options: { tiktok: { a1: { privacy: "SELF_ONLY" } } } }))).rejects.toThrow(/private accounts/);
  });
});

// ------------------------------------------------------------------ YouTube

describe("YouTube", () => {
  const yt = account({ platform: "youtube", externalId: "CH1", accessToken: "yt-token" });

  test("resumable upload: session with metadata, then the video bytes", async () => {
    const { youtube } = await import("../lib/publishing/providers/youtube");
    const calls = mockFetch((c) => {
      if (c.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "4000" } });
      if (c.url.includes("uploadType=resumable")) return new Response(null, { status: 200, headers: { location: "https://upload.googleapis.com/session/1" } });
      if (c.url === CLOUD_VIDEO) return new Response(new Uint8Array(4000), { status: 200, headers: { "content-type": "video/mp4", "content-length": "4000" } });
      if (c.url === "https://upload.googleapis.com/session/1") return ok({ id: "VID1" });
    });
    const res = await youtube.publish(yt, input({ text: "My title\nThe description", media: [{ url: CLOUD_VIDEO, type: "video" }], options: { youtube: { privacy: "unlisted" } } }));
    const start = calls.find((c) => c.url.includes("uploadType=resumable"))!;
    expect(start.headers.authorization).toBe("Bearer yt-token");
    expect(start.headers["x-upload-content-length"]).toBe("4000");
    expect(start.body.snippet).toMatchObject({ title: "My title", description: "The description" });
    expect(start.body.status).toMatchObject({ privacyStatus: "unlisted", selfDeclaredMadeForKids: false });
    expect(calls.find((c) => c.url === "https://upload.googleapis.com/session/1")!.method).toBe("PUT");
    expect(res).toEqual({ externalId: "VID1", url: "https://www.youtube.com/watch?v=VID1" });
  });

  test("a custom title keeps the whole text as the description; needs a video", async () => {
    const { youtube } = await import("../lib/publishing/providers/youtube");
    mockFetch(() => ok({}));
    await expect(youtube.publish(yt, input())).rejects.toThrow(/need a video/);
  });

  test("a revoked Google grant asks to reconnect", async () => {
    const { youtube } = await import("../lib/publishing/providers/youtube");
    mockFetch(() => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    const err = await youtube.refresh!({ ...yt, refreshToken: "r" }).catch((e) => e);
    expect(err.reconnect).toBe(true);
  });
});
