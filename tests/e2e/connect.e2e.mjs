/**
 * End-to-end test of the OAuth connect routes using a fake Mastodon server.
 *
 *   bun run dev   (other terminal)
 *   node --env-file=.env.local tests/e2e/connect.e2e.mjs
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../package.json", import.meta.url));
const mongoose = require("mongoose");
const { SignJWT } = require("jose");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
  console.error("Run with --env-file=.env.local");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

// ------------------------------------------------------ fake Mastodon server
const seen = { apps: 0, tokens: 0 };
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();
  const json = (obj, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.url === "/api/v1/apps") { seen.apps++; return json({ client_id: "cid", client_secret: "csecret" }); }
  if (req.url === "/oauth/token") {
    seen.tokens++;
    const p = new URLSearchParams(body);
    if (p.get("code") !== "good-code" || p.get("client_id") !== "cid" || p.get("client_secret") !== "csecret") return json({ error: "invalid_grant" }, 400);
    return json({ access_token: "mastodon-access-token", token_type: "Bearer" });
  }
  if (req.url === "/api/v1/accounts/verify_credentials") {
    return req.headers.authorization === "Bearer mastodon-access-token"
      ? json({ id: "42", username: "tester", acct: "tester", display_name: "Test Er", avatar: "http://x/a.png", url: "http://x/@tester" })
      : json({ error: "unauthorized" }, 401);
  }
  if (req.url === "/api/v2/instance") return json({ configuration: { statuses: { max_characters: 5000, max_media_attachments: 6 } } });
  json({ error: "not found" }, 404);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const FAKE = `http://127.0.0.1:${server.address().port}`;

// -------------------------------------------------------------------- setup
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
const users = db.collection("users");
const accounts = db.collection("socialaccounts");
const apps = db.collection("mastodonapps");

const mkUser = async (email) => {
  await users.deleteMany({ email });
  const { insertedId } = await users.insertOne({ name: "Connect", email, emailVerified: true, plan: "free", role: "user", createdAt: new Date(), updatedAt: new Date() });
  const token = await new SignJWT({ sub: String(insertedId) }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("20m").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  return { id: insertedId, email, session: `qs_session=${token}` };
};
const alice = await mkUser("claude-connect-a@example.invalid");
const bob = await mkUser("claude-connect-b@example.invalid");

const get = (path, cookie) => fetch(`${BASE}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
const setCookieOf = (res, name) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith(`${name}=`));

try {
  console.log("\nStart");
  let r = await get("/api/connect/mastodon?instance=" + encodeURIComponent(FAKE));
  check("signed-out users are sent to /login", r.status === 307 && new URL(r.headers.get("location")).pathname === "/login", `${r.status} ${r.headers.get("location")}`);

  r = await get("/api/connect/nope", alice.session);
  check("unknown network is rejected", new URL(r.headers.get("location")).searchParams.get("error") === "unknown_platform");

  r = await get("/api/connect/x", alice.session);
  let loc = new URL(r.headers.get("location"));
  check("an unconfigured network says setup is needed", loc.pathname === "/dashboard/accounts" && loc.searchParams.get("error") === "not_configured" && loc.searchParams.get("platform") === "x", r.headers.get("location"));

  r = await get("/api/connect/instagram", alice.session);
  loc = new URL(r.headers.get("location"));
  check("Instagram goes through the Meta (Facebook) flow", loc.searchParams.get("error") === "not_configured", r.headers.get("location"));

  r = await get("/api/connect/mastodon", alice.session);
  loc = new URL(r.headers.get("location"));
  check("Mastodon without a server fails politely", loc.searchParams.get("error") === "failed", r.headers.get("location"));

  console.log("\nMastodon sign-in");
  r = await get("/api/connect/mastodon?instance=" + encodeURIComponent(FAKE), alice.session);
  check("redirects to the server's authorize page", r.status === 307, String(r.status));
  const authUrl = new URL(r.headers.get("location"));
  check("authorize URL is on the user's server", authUrl.origin === FAKE && authUrl.pathname === "/oauth/authorize", authUrl.toString());
  check("it carries the registered client id, scopes and our callback", authUrl.searchParams.get("client_id") === "cid" && authUrl.searchParams.get("scope") === "read:accounts write:statuses write:media" && authUrl.searchParams.get("redirect_uri")?.endsWith("/api/connect/mastodon/callback"), authUrl.search);
  const state = authUrl.searchParams.get("state");
  const stateCookie = setCookieOf(r, "qs_oauth");
  check("a state cookie is set", !!stateCookie && !!state);
  const rawCookie = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("qs_oauth=")) ?? "";
  check("the cookie is HttpOnly, SameSite=Lax and scoped to /api/connect", /HttpOnly/i.test(rawCookie) && /SameSite=lax/i.test(rawCookie) && /Path=\/api\/connect/i.test(rawCookie), rawCookie);
  check("the OAuth app was registered once", seen.apps === 1);

  // A second sign-in reuses the stored client instead of registering again.
  await get("/api/connect/mastodon?instance=" + encodeURIComponent(FAKE), alice.session);
  check("a repeat sign-in reuses the stored app", seen.apps === 1, `registered ${seen.apps} times`);

  console.log("\nCallback safety");
  const cb = (qs, cookie) => get(`/api/connect/mastodon/callback?${qs}`, cookie);
  r = await cb(`code=good-code&state=${state}`, alice.session);
  check("no state cookie → rejected", new URL(r.headers.get("location")).searchParams.get("error") === "invalid_state");

  r = await cb(`code=good-code&state=tampered`, `${alice.session}; ${stateCookie}`);
  check("wrong state value → rejected", new URL(r.headers.get("location")).searchParams.get("error") === "invalid_state");

  r = await cb(`code=good-code&state=${state}`, `${bob.session}; ${stateCookie}`);
  check("a different signed-in user can't complete someone else's flow", new URL(r.headers.get("location")).searchParams.get("error") === "invalid_state");

  r = await cb(`error=access_denied&error_description=User%20said%20no`, `${alice.session}; ${stateCookie}`);
  loc = new URL(r.headers.get("location"));
  check("the user cancelling is handled", loc.searchParams.get("error") === "denied" && loc.searchParams.get("detail") === "User said no", r.headers.get("location"));

  r = await cb(`code=bad-code&state=${state}`, `${alice.session}; ${stateCookie}`);
  loc = new URL(r.headers.get("location"));
  check("a rejected code reports a failure", loc.searchParams.get("error") === "failed", r.headers.get("location"));
  check("nothing was stored for a failed connect", (await accounts.countDocuments({ userId: alice.id })) === 0);

  console.log("\nSuccessful connect");
  r = await cb(`code=good-code&state=${state}`, `${alice.session}; ${stateCookie}`);
  loc = new URL(r.headers.get("location"));
  check("redirects back to Accounts with a success flash", loc.pathname === "/dashboard/accounts" && loc.searchParams.get("connected") === "mastodon" && loc.searchParams.get("count") === "1", r.headers.get("location"));
  const acc = await accounts.findOne({ userId: alice.id, platform: "mastodon" });
  check("the account is stored", !!acc);
  check("identity is correct", acc?.externalId === `tester@127.0.0.1:${server.address().port}` && acc?.displayName === "Test Er" && acc?.handle.startsWith("@tester@"), JSON.stringify(acc));
  check("the server and its real limits are remembered", acc?.meta?.instance === FAKE && acc?.meta?.maxChars === 5000 && acc?.meta?.maxMedia === 6, JSON.stringify(acc?.meta));
  check("the token is stored encrypted, not in plain text", !!acc?.accessTokenEnc && !acc.accessTokenEnc.includes("mastodon-access-token") && acc.accessTokenEnc.split(".").length === 3);
  check("the account is active", acc?.status === "active");
  check("the stored client secret is encrypted too", !JSON.stringify(await apps.findOne({ instance: FAKE })).includes("csecret"));

  console.log("\nReconnecting the same account updates it instead of duplicating");
  r = await get("/api/connect/mastodon?instance=" + encodeURIComponent(FAKE), alice.session);
  const s2 = new URL(r.headers.get("location")).searchParams.get("state");
  await cb(`code=good-code&state=${s2}`, `${alice.session}; ${setCookieOf(r, "qs_oauth")}`);
  check("still exactly one account", (await accounts.countDocuments({ userId: alice.id, platform: "mastodon" })) === 1);
  check("and it belongs to Alice only", (await accounts.countDocuments({ userId: bob.id })) === 0);
} finally {
  server.close();
  await accounts.deleteMany({ userId: { $in: [alice.id, bob.id] } });
  await apps.deleteMany({ instance: FAKE });
  await users.deleteMany({ email: { $in: [alice.email, bob.email] } });
  await mongoose.disconnect();
}

console.log(`\n${failed ? "FAILED" : "ALL OK"}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
