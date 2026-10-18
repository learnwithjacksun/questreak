/**
 * End-to-end test of the publishing engine against a REAL database and the running app.
 *
 *   1. bun run dev            (in another terminal)
 *   2. node --env-file=.env.local tests/e2e/scheduler.e2e.mjs
 *
 * It starts fake Bluesky and Mastodon servers on localhost, creates a throwaway user with
 * connected accounts pointing at them, schedules posts, calls /api/cron/publish, and checks what
 * the fake networks received. Everything it creates is deleted afterwards.
 */
import { createCipheriv, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../package.json", import.meta.url));
const mongoose = require("mongoose");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.CRON_SECRET;
if (!SECRET || !process.env.MONGODB_URI || !process.env.ENCRYPTION_KEY) {
  console.error("Needs MONGODB_URI, ENCRYPTION_KEY and CRON_SECRET (run with --env-file=.env.local).");
  process.exit(1);
}

const encrypt = (plain) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(process.env.ENCRYPTION_KEY, "hex"), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
};

// ------------------------------------------------------------ fake networks
function fakeNetwork(kind, { fail = false } = {}) {
  const log = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    let body;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
    log.push({ method: req.method, path: req.url, body });
    const json = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

    if (kind === "bluesky") {
      if (req.url.endsWith("createSession")) return json(200, { did: "did:plc:test", handle: "e2e.test", accessJwt: "jwt" });
      if (req.url.endsWith("createRecord")) return fail ? json(500, { error: "InternalServerError", message: "pds is down" }) : json(200, { uri: `at://did:plc:test/app.bsky.feed.post/${log.length}` });
    } else {
      if (req.url.endsWith("/api/v2/instance")) return json(200, { configuration: { statuses: { max_characters: 500, max_media_attachments: 4 } } });
      if (req.url.endsWith("/api/v1/statuses")) return fail ? json(422, { error: "Validation failed: Text can't be blank" }) : json(200, { id: String(log.length), url: `http://x/@me/${log.length}` });
    }
    json(404, { error: "not found" });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({
      url: `http://127.0.0.1:${server.address().port}`,
      log,
      posts: () => log.filter((l) => /createRecord|\/api\/v1\/statuses/.test(l.path)).length,
      setFail: (v) => (fail = v),
      close: () => server.close(),
    })),
  );
}

// ------------------------------------------------------------------ helpers
let passed = 0;
let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};
const cron = (secret = SECRET) => fetch(`${BASE}/api/cron/publish`, { headers: { authorization: `Bearer ${secret}` } });

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
const users = db.collection("users");
const accounts = db.collection("socialaccounts");
const posts = db.collection("posts");

const email = "claude-e2e@example.invalid";
await users.deleteMany({ email });
const { insertedId: userId } = await users.insertOne({ name: "E2E", email, emailVerified: true, plan: "free", role: "user", createdAt: new Date(), updatedAt: new Date() });

const good = await fakeNetwork("bluesky");
const mast = await fakeNetwork("mastodon", { fail: true });

const mkAccount = async (platform, handle, meta, extra = {}) => {
  const { insertedId } = await accounts.insertOne({
    userId, platform, externalId: `${platform}-${handle}`, handle, displayName: handle,
    accessTokenEnc: encrypt("secret-token"), meta, status: "active", scopes: [],
    createdAt: new Date(), updatedAt: new Date(), ...extra,
  });
  return insertedId;
};
const bsky = await mkAccount("bluesky", "e2e.test", { pds: good.url });
const masto = await mkAccount("mastodon", "@e2e@fake.test", { instance: mast.url });

const mkPost = async (targets, over = {}) => {
  const { insertedId } = await posts.insertOne({
    userId, text: "End to end hello", media: [], options: {}, status: "scheduled",
    scheduledFor: new Date(Date.now() - 5_000), targets: targets.map((t) => ({ accountId: t.id, platform: t.platform, status: t.status ?? "pending", attempts: 0 })),
    createdAt: new Date(), updatedAt: new Date(), ...over,
  });
  return insertedId;
};
const target = (post, id) => post.targets.find((t) => String(t.accountId) === String(id));

try {
  console.log("\nAuthorization");
  check("cron without the secret is rejected", (await cron("wrong")).status === 401);
  check("cron with the secret is accepted", (await cron()).status === 200);

  console.log("\n1. A due scheduled post is published exactly once");
  const p1 = await mkPost([{ id: bsky, platform: "bluesky" }]);
  // Two workers firing at the same instant must not double-post.
  const [a, b] = await Promise.all([cron(), cron()]);
  const sums = [await a.json(), await b.json()];
  const doc1 = await posts.findOne({ _id: p1 });
  check("status is published", doc1.status === "published", doc1.status);
  check("target has the network url", /bsky\.app\/profile\/e2e\.test\/post\//.test(target(doc1, bsky).externalUrl ?? ""), JSON.stringify(target(doc1, bsky)));
  check("publishedAt is set", !!doc1.publishedAt);
  check("the network received exactly ONE post", good.posts() === 1, `got ${good.posts()}`);
  check("only one of the two workers published it", sums.reduce((n, s) => n + s.published, 0) === 1, JSON.stringify(sums));
  const record = good.log.find((l) => l.path.endsWith("createRecord"))?.body;
  check("record carried the post text", record?.record?.text === "End to end hello");
  const again = await (await cron()).json();
  check("a later run finds nothing due", again.due === 0, JSON.stringify(again));
  check("still exactly one post", good.posts() === 1);

  console.log("\n2. Partial failure, then a retry that doesn't duplicate");
  const before = good.posts();
  const p2 = await mkPost([{ id: bsky, platform: "bluesky" }, { id: masto, platform: "mastodon" }]);
  await cron();
  let doc2 = await posts.findOne({ _id: p2 });
  check("post is failed (one target failed)", doc2.status === "failed", doc2.status);
  check("bluesky target published", target(doc2, bsky).status === "published");
  check("mastodon target failed with the network's reason", target(doc2, masto).status === "failed" && /Validation failed/.test(target(doc2, masto).error ?? ""), target(doc2, masto).error);
  check("bluesky got one new post", good.posts() === before + 1);

  mast.setFail(false);
  await posts.updateOne({ _id: p2 }, { $set: { status: "scheduled", scheduledFor: new Date(Date.now() - 1_000) } }); // "retry"
  await cron();
  doc2 = await posts.findOne({ _id: p2 });
  check("after the retry the post is published", doc2.status === "published", doc2.status);
  check("mastodon target published", target(doc2, masto).status === "published");
  check("bluesky was NOT sent a duplicate", good.posts() === before + 1, `got ${good.posts() - before} new posts`);
  check("attempts are counted per target", target(doc2, masto).attempts === 2 && target(doc2, bsky).attempts === 1, JSON.stringify(doc2.targets.map((t) => t.attempts)));

  console.log("\n3. An account whose token can't be renewed is flagged for reconnect");
  const li = await mkAccount("linkedin", "member", {}, { expiresAt: new Date(Date.now() - 60_000) });
  const p3 = await mkPost([{ id: li, platform: "linkedin" }]);
  await cron();
  const doc3 = await posts.findOne({ _id: p3 });
  const liDoc = await accounts.findOne({ _id: li });
  check("post failed", doc3.status === "failed");
  check("target says it needs a reconnect", target(doc3, li).needsReconnect === true, JSON.stringify(target(doc3, li)));
  check("account is marked expired", liDoc.status === "expired", liDoc.status);
  const p3b = await mkPost([{ id: li, platform: "linkedin" }]);
  await cron();
  const doc3b = await posts.findOne({ _id: p3b });
  check("an expired account is refused without calling the network", /reconnect/i.test(target(doc3b, li).error ?? ""), target(doc3b, li).error);

  console.log("\n4. Validation happens before anything is sent");
  const before4 = good.posts();
  const p4 = await mkPost([{ id: bsky, platform: "bluesky" }], { text: "x".repeat(301) });
  await cron();
  const doc4 = await posts.findOne({ _id: p4 });
  check("over-length post fails with a clear message", doc4.status === "failed" && /over the 300 limit/.test(target(doc4, bsky).error ?? ""), target(doc4, bsky).error);
  check("nothing was sent to the network", good.posts() === before4);

  console.log("\n5. A crashed run is recovered");
  const p5 = await mkPost([{ id: bsky, platform: "bluesky" }], { status: "publishing", publishStartedAt: new Date(Date.now() - 30 * 60_000) });
  const rec = await (await cron()).json();
  const doc5 = await posts.findOne({ _id: p5 });
  check("stale 'publishing' post is failed so it can be retried", doc5.status === "failed" && /timed out/.test(target(doc5, bsky).error ?? ""), `${doc5.status} ${target(doc5, bsky).error}`);
  check("recovery is reported", rec.recovered >= 1, JSON.stringify(rec));

  console.log("\n6. A post that isn't due yet is left alone");
  const before6 = good.posts();
  const p6 = await mkPost([{ id: bsky, platform: "bluesky" }], { scheduledFor: new Date(Date.now() + 3600_000) });
  await cron();
  check("future post stays scheduled", (await posts.findOne({ _id: p6 })).status === "scheduled");
  check("nothing sent", good.posts() === before6);
} finally {
  good.close(); mast.close();
  await posts.deleteMany({ userId });
  await accounts.deleteMany({ userId });
  await users.deleteMany({ email });
  await mongoose.disconnect();
}

console.log(`\n${failed ? "FAILED" : "ALL OK"}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
