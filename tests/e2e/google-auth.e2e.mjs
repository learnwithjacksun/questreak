/**
 * End-to-end test of "Continue with Google" using a fake Google. It starts its own copy of the
 * app on port 3100 (your normal dev server is not touched).
 *
 *   node --env-file=.env.local tests/e2e/google-auth.e2e.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../package.json", import.meta.url));
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

if (!process.env.MONGODB_URI) { console.error("Run with --env-file=.env.local"); process.exit(1); }

let passed = 0;
let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

// ------------------------------------------------------------ fake Google
const profiles = {
  "code-new": { sub: "g-new-1", email: "claude-g-new@example.invalid", email_verified: true, given_name: "Gina", name: "Gina Test", picture: "http://x/p.png" },
  "code-link": { sub: "g-link-1", email: "claude-g-link@example.invalid", email_verified: true, given_name: "Linky", picture: "http://x/l.png" },
  "code-hijack": { sub: "g-victim-1", email: "claude-g-victim@example.invalid", email_verified: true, given_name: "Victim" },
  "code-unverified": { sub: "g-u-1", email: "claude-g-unverified@example.invalid", email_verified: false, given_name: "Nope" },
  "code-conflict": { sub: "g-OTHER", email: "claude-g-conflict@example.invalid", email_verified: true, given_name: "Other" },
};
const tokens = new Map();
const fake = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = new URLSearchParams(Buffer.concat(chunks).toString());
  const json = (obj, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.url === "/token") {
    const code = body.get("code");
    if (code === "code-tokenfail") return json({ error: "invalid_grant" }, 400);
    if (body.get("client_id") !== "fake-client" || body.get("client_secret") !== "fake-secret") return json({ error: "invalid_client" }, 401);
    if (!body.get("redirect_uri")?.endsWith("/api/auth/google/callback")) return json({ error: "redirect_uri_mismatch" }, 400);
    const t = `tok-${code}`;
    tokens.set(t, profiles[code] ?? profiles["code-new"]);
    return json({ access_token: t, token_type: "Bearer" });
  }
  if (req.url === "/userinfo") {
    const p = tokens.get((req.headers.authorization ?? "").replace("Bearer ", ""));
    return p ? json(p) : json({ error: "unauthorized" }, 401);
  }
  json({ error: "not found" }, 404);
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));
const FAKE = `http://127.0.0.1:${fake.address().port}`;

// ------------------------------------------------- our app on port 3100
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
let serverLog = "";
const app = spawn(process.platform === "win32" ? "bun.exe" : "bun", ["run", "dev", "-p", String(PORT)], {
  cwd: new URL("../../", import.meta.url),
  env: {
    ...process.env,
    APP_URL: BASE,
    GOOGLE_CLIENT_ID: "fake-client",
    GOOGLE_CLIENT_SECRET: "fake-secret",
    GOOGLE_AUTH_URL: `${FAKE}/auth`,
    GOOGLE_TOKEN_URL: `${FAKE}/token`,
    GOOGLE_USERINFO_URL: `${FAKE}/userinfo`,
    BREVO_API_KEY: "", // dev mode prints emails instead of sending them
  },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", (d) => (serverLog += d));
app.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; i < 60 && !/Ready/.test(serverLog); i++) await new Promise((r) => setTimeout(r, 1000));
if (!/Ready/.test(serverLog)) { console.error("App didn't start:\n" + serverLog.slice(-800)); app.kill(); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.collection("users");
const emails = Object.values(profiles).map((p) => p.email);
await users.deleteMany({ email: { $in: emails } });

const get = (path, cookie) => fetch(`${BASE}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
const cookieOf = (res, name) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith(`${name}=`));

/** Runs the whole flow for one fake Google user and returns the callback response + start cookie. */
async function signInWith(code, { state } = {}) {
  const start = await get("/api/auth/google");
  const gState = cookieOf(start, "g_state");
  const startUrl = new URL(start.headers.get("location"));
  const cb = await get(`/api/auth/google/callback?code=${code}&state=${state ?? startUrl.searchParams.get("state")}`, gState);
  return { start, startUrl, cb, loc: new URL(cb.headers.get("location")) };
}

try {
  console.log("\nStart");
  const { start, startUrl } = await signInWith("code-new").then(async (r) => r);
  check("redirects to Google's consent screen", startUrl.origin === FAKE && startUrl.pathname === "/auth", startUrl.toString());
  check("asks only for identity scopes", startUrl.searchParams.get("scope") === "openid email profile", startUrl.searchParams.get("scope"));
  check("sends our client id and callback", startUrl.searchParams.get("client_id") === "fake-client" && startUrl.searchParams.get("redirect_uri") === `${BASE}/api/auth/google/callback`);
  const raw = (start.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("g_state=")) ?? "";
  check("state cookie is HttpOnly + SameSite=Lax", /HttpOnly/i.test(raw) && /SameSite=lax/i.test(raw), raw);

  await users.deleteMany({ email: { $in: emails } }); // the "new user" run above created Gina; reset

  console.log("\nNew user via Google (sign up)");
  let r = await signInWith("code-new");
  check("lands on the dashboard", r.loc.pathname === "/dashboard", r.cb.headers.get("location"));
  check("a session cookie is issued", !!cookieOf(r.cb, "qs_session"));
  let u = await users.findOne({ email: profiles["code-new"].email });
  check("a verified user was created from the Google profile", !!u && u.emailVerified === true && u.googleId === "g-new-1" && u.name === "Gina" && u.avatar === "http://x/p.png", JSON.stringify(u));
  check("it has no password", !u?.passwordHash);
  check("a welcome email was sent to the new user", /\[dev email\] to: claude-g-new@example\.invalid\s+subject: Welcome to Questreak/.test(serverLog), serverLog.slice(-300));

  const welcomesAfterSignup = (serverLog.match(/to: claude-g-new@example\.invalid\s+subject: Welcome/g) ?? []).length;

  console.log("\nReturning Google user (sign in)");
  const countBefore = await users.countDocuments({ email: profiles["code-new"].email });
  r = await signInWith("code-new");
  check("signs straight in", r.loc.pathname === "/dashboard" && !!cookieOf(r.cb, "qs_session"));
  check("no duplicate user", (await users.countDocuments({ email: profiles["code-new"].email })) === countBefore && countBefore === 1);
  const welcomesNow = (serverLog.match(/to: claude-g-new@example\.invalid\s+subject: Welcome/g) ?? []).length;
  check("no second welcome email for a returning user", welcomesNow === welcomesAfterSignup, `before ${welcomesAfterSignup}, after ${welcomesNow}`);

  console.log("\nExisting verified email/password account is linked, not duplicated");
  const hash = await bcrypt.hash("Password123", 4);
  await users.insertOne({ name: "Original", email: profiles["code-link"].email, passwordHash: hash, emailVerified: true, plan: "free", role: "user", createdAt: new Date(), updatedAt: new Date() });
  r = await signInWith("code-link");
  u = await users.findOne({ email: profiles["code-link"].email });
  check("signed in to the existing account", r.loc.pathname === "/dashboard");
  check("Google was linked to it", u.googleId === "g-link-1" && (await users.countDocuments({ email: profiles["code-link"].email })) === 1);
  check("their password still works", !!u.passwordHash && (await bcrypt.compare("Password123", u.passwordHash)));
  check("their name was kept", u.name === "Original");

  console.log("\nPre-hijack guard");
  await users.insertOne({ name: "Attacker", email: profiles["code-hijack"].email, passwordHash: await bcrypt.hash("attacker-pass1", 4), emailVerified: false, plan: "free", role: "user", createdAt: new Date(), updatedAt: new Date() });
  r = await signInWith("code-hijack");
  u = await users.findOne({ email: profiles["code-hijack"].email });
  check("the real owner can sign in with Google", r.loc.pathname === "/dashboard");
  check("the email is now verified and linked", u.emailVerified === true && u.googleId === "g-victim-1");
  check("the attacker's password was removed", !u.passwordHash, "password still present!");

  console.log("\nRefusals");
  r = await signInWith("code-unverified");
  check("an email Google hasn't verified is refused", r.loc.pathname === "/login" && r.loc.searchParams.get("error") === "google_failed");
  check("and no account is created", (await users.countDocuments({ email: profiles["code-unverified"].email })) === 0);
  check("and no session is issued", !cookieOf(r.cb, "qs_session"));

  await users.insertOne({ name: "Has Google", email: profiles["code-conflict"].email, googleId: "g-ORIGINAL", emailVerified: true, plan: "free", role: "user", createdAt: new Date(), updatedAt: new Date() });
  r = await signInWith("code-conflict");
  check("a different Google account can't take over a linked email", r.loc.searchParams.get("error") === "google_failed" && !cookieOf(r.cb, "qs_session"));

  r = await signInWith("code-new", { state: "tampered" });
  check("a wrong state is refused", r.loc.searchParams.get("error") === "google_failed" && !cookieOf(r.cb, "qs_session"));

  const noCookie = await get(`/api/auth/google/callback?code=code-new&state=abc`);
  check("no state cookie is refused", new URL(noCookie.headers.get("location")).searchParams.get("error") === "google_failed");

  r = await signInWith("code-tokenfail");
  check("a failed code exchange is reported", r.loc.searchParams.get("error") === "google_failed");

  const cancelled = await get(`/api/auth/google/callback?error=access_denied`);
  check("cancelling is handled quietly", new URL(cancelled.headers.get("location")).searchParams.get("error") === "google_cancelled");

  console.log("\nAfter signing in");
  r = await signInWith("code-new");
  const session = cookieOf(r.cb, "qs_session");
  const login = await get("/login", session);
  check("a signed-in user visiting /login is sent to the dashboard", login.status === 307 && new URL(login.headers.get("location"), BASE).pathname === "/dashboard");
  const dash = await get("/dashboard", session);
  check("the dashboard loads for the Google user", dash.status === 200, String(dash.status));
} finally {
  await users.deleteMany({ email: { $in: emails } });
  await mongoose.disconnect();
  fake.close();
  app.kill();
  if (process.platform === "win32" && app.pid) spawn("taskkill", ["/F", "/T", "/PID", String(app.pid)], { stdio: "ignore" });
}

console.log(`\n${failed ? "FAILED" : "ALL OK"}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
