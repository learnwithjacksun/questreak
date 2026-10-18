# Connecting social networks

Questreak publishes straight to each network's official API. Nothing is paid to an aggregator, but
each network wants an app registered in its developer portal, and Meta and TikTok review apps before
real users can use them. This guide lists exactly what to create, where, and what to put in `.env.local`.

Set `APP_URL` in `.env.local` to your **public** HTTPS domain before registering anything. Every
redirect URI below is built from it.

## Redirect URIs (register these in each portal)

| Network | Redirect URI |
|---|---|
| Facebook + Instagram | `{APP_URL}/api/connect/facebook/callback` |
| Threads | `{APP_URL}/api/connect/threads/callback` |
| LinkedIn | `{APP_URL}/api/connect/linkedin/callback` |
| X | `{APP_URL}/api/connect/x/callback` |
| TikTok | `{APP_URL}/api/connect/tiktok/callback` |
| Pinterest | `{APP_URL}/api/connect/pinterest/callback` |
| YouTube (Google) | `{APP_URL}/api/connect/youtube/callback` |
| Bluesky, Mastodon | none (app password / auto-registered per server) |

Most portals reject plain `http://` and `localhost` for production use. For local testing, Mastodon,
Bluesky, X and LinkedIn accept `http://localhost:3000`; Meta and TikTok need HTTPS (use a tunnel such
as ngrok or Cloudflare Tunnel and set `APP_URL` to it).

Public pages these reviews ask for already exist: `/privacy`, `/terms`, `/data-deletion`.
Set `NEXT_PUBLIC_SUPPORT_EMAIL` so those pages show your real contact address.

---

## Meta: Facebook Pages + Instagram (one app)

1. Create the app: <https://developers.facebook.com/apps/creation/>
   Use case: **Other** → app type **Business**.
2. Add products: **Facebook Login for Business** and **Instagram** (API with Facebook Login).
3. Facebook Login → Settings → *Valid OAuth Redirect URIs*: `{APP_URL}/api/connect/facebook/callback`.
4. App settings → Basic: add the **Privacy Policy URL** (`{APP_URL}/privacy`), **Terms of Service URL**
   (`{APP_URL}/terms`) and **User data deletion** → *Data deletion instructions URL*
   (`{APP_URL}/data-deletion`). Choose a category, add an app icon.
5. Copy **App ID** and **App secret** into `META_APP_ID` / `META_APP_SECRET`.
6. Business verification (needed for Advanced Access):
   <https://developers.facebook.com/docs/development/release/business-verification>
   (Business settings → Security Center: <https://business.facebook.com/settings/security>).
7. Submit **App Review**:
   - Docs: <https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review>
   - In your app dashboard: **App Review → Permissions and features**. Request Advanced Access for each of:
     `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_read_user_engagement`,
     `publish_video`, `instagram_basic`, `instagram_content_publish`, `business_management`.
   - For each permission Meta wants: a clear description of how Questreak uses it, and a **screencast**
     showing the full flow (sign in → Connect Facebook → pick Page → Compose → Publish → post appears on the
     Page/Instagram). Use only the permissions you demonstrate.
   - Provide a test user or reviewer instructions. While in *Development* mode, only people with a role on the
     app (Roles → Roles) can connect, so add yourself and testers there to build and film the flow.
8. Switch the app to **Live** once approved.

Instagram needs a **Business or Creator** account linked to a Facebook Page. Facebook publishing is for
**Pages**, not personal profiles.

## Threads (a separate Meta product)

1. In the same Meta developer account, create or open an app and add the **Threads API** use case.
   Docs: <https://developers.facebook.com/docs/threads/get-started>
2. Threads → Settings: add redirect URI `{APP_URL}/api/connect/threads/callback`, and the deauthorize/delete
   callback URLs (you can use `{APP_URL}/data-deletion`).
3. Copy the **Threads app ID / secret** (shown under Threads settings, not the main app id) into
   `THREADS_APP_ID` / `THREADS_APP_SECRET`.
4. Permissions: `threads_basic`, `threads_content_publish`. Add testers under Roles → Threads testers while in
   development; request Advanced Access via App Review for public use.

## TikTok (Login Kit + Content Posting API)

1. Developer portal: <https://developers.tiktok.com/apps/> → **Create app** (register as a developer first).
2. Add products **Login Kit** and **Content Posting API**. Enable **Direct Post**.
3. Login Kit → Redirect URI: `{APP_URL}/api/connect/tiktok/callback`.
4. Scopes: `user.info.basic`, `video.publish`, `video.upload`.
5. App details: icon, description, **Terms of Service URL** and **Privacy Policy URL**
   (`{APP_URL}/terms`, `{APP_URL}/privacy`).
6. **Verify your URL properties** (needed for photo posts, which TikTok can only pull from a URL): in the app's
   *URL properties*, verify the prefix `{APP_URL}/api/public-media/` (or your whole domain). Questreak serves photos
   from there through signed, expiring links. Video posts upload files directly and need nothing extra.
7. Copy **Client key** / **Client secret** into `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
8. **App review** (guidelines: <https://developers.tiktok.com/docs/en/app-review-guidelines>): explain each product and
   scope, and upload a demo video (up to 5, 50 MB each) showing the complete end-to-end flow. TikTok's UX rules for Direct
   Post are already built into Compose: it shows the creator, lets users pick visibility (no default), shows comment/duet/stitch
   toggles (off by default), a commercial-content disclosure, the Music Usage Confirmation consent line, a preview, and
   status/processing messaging. Record those in the video.
9. **Content Posting API audit**, which lifts the "private only" restriction:
   <https://developers.tiktok.com/application/content-posting-api>
   Until it passes, every post is forced to **Only me** and the TikTok account must be private (and at most 5 users
   can post per day). Keep `TIKTOK_AUDITED=false` until then, then set it to `true` to unlock the other visibility options.

While unaudited, use the **Sandbox** and add your own TikTok account as a test user to try the flow.

## X (Twitter)

1. Developer portal: <https://developer.x.com/en/portal/dashboard> → create a Project and an App.
2. App settings → **User authentication settings**: OAuth 2.0, type **Web App / Confidential client**,
   permissions **Read and write**, callback `{APP_URL}/api/connect/x/callback`, website `{APP_URL}`.
3. Copy **Client ID / Client Secret** (OAuth 2.0) into `X_CLIENT_ID` / `X_CLIENT_SECRET`.
4. Posting needs a paid plan / credits on the X API. Without them, X rejects the post and Questreak shows that reason.
   Check X's current pricing before enabling it for customers.

## LinkedIn (personal profile posting)

1. <https://www.linkedin.com/developers/apps> → **Create app** (needs a LinkedIn Page to associate).
2. Products tab: request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** (both self-serve).
3. Auth tab → Authorized redirect URL: `{APP_URL}/api/connect/linkedin/callback`.
4. Copy **Client ID / Primary Client Secret** into `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
5. `LINKEDIN_API_VERSION` is a `YYYYMM` API version. LinkedIn retires versions after about a year, so update it
   periodically (see <https://learn.microsoft.com/en-us/linkedin/marketing/versioning>).

Tokens last 60 days and LinkedIn doesn't issue refresh tokens to normal apps, so users reconnect when one expires
(Questreak shows "Reconnect needed"). **Company Pages** need the separate Community Management API approval.

## YouTube (Google)

1. <https://console.cloud.google.com/apis/credentials>: use the same project as Google sign-in. Enable **YouTube Data API v3**.
2. OAuth consent screen: add scopes `youtube.upload` and `youtube.readonly`. While in *Testing*, only listed test users
   can connect; publish the app and complete Google's **OAuth verification** for everyone else (needs the privacy policy URL).
3. Credentials → your OAuth client → Authorized redirect URIs: add `{APP_URL}/api/connect/youtube/callback`.
4. Uses the existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Uploads from a new API project are locked to **private** until it passes YouTube's API compliance audit
   (<https://support.google.com/youtube/contact/yt_api_form>). The default quota (10,000 units/day) allows about 6 uploads/day.

## Pinterest

1. <https://developers.pinterest.com/apps/> → **Connect app**. New apps start with **Trial** access.
2. Redirect URI: `{APP_URL}/api/connect/pinterest/callback`. Scopes used: `boards:read`, `pins:read`, `pins:write`, `user_accounts:read`.
3. Copy **App ID / App secret** into `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET`.
4. On Trial, use the sandbox: `PINTEREST_API_BASE=https://api-sandbox.pinterest.com/v5`. Apply for **Standard access** (demo video of
   the flow) to post to real boards, then set it back to `https://api.pinterest.com/v5`.

## Bluesky

No app to register. Users connect with their handle and an **app password**
(<https://bsky.app/settings/app-passwords>). Self-hosted servers are supported through the "I host my own server" option.

## Mastodon

No app to register. The user enters their server (for example `mastodon.social`); Questreak registers an OAuth app on that
server the first time and stores the credentials encrypted. Each server's own character and attachment limits are read and enforced.

---

## Scheduling

Scheduled posts need something to call the worker once a minute. The app doesn't ship a Vercel cron
config, because Vercel's Hobby plan only allows daily jobs. Use an external scheduler instead:

1. Set `CRON_SECRET` in your host's environment variables (same value as in `.env.local`).
2. Create two jobs in cron-jobs.org, Google Apps Script, GitHub Actions or any scheduler.
   Both need the header `Authorization: Bearer $CRON_SECRET`:

| Job | URL | Schedule |
|---|---|---|
| Publish due posts | `GET {APP_URL}/api/cron/publish` | every minute |
| Renew expiring tokens | `GET {APP_URL}/api/cron/refresh` | once a day |

If a scheduler can't send headers, the secret can go in the query string instead (`?secret=...`),
though headers are safer because URLs end up in logs.

A normal response is `{"due":0,"published":0,"failed":0,"recovered":0}`; `401` means the secret doesn't match.

- **Self-hosted Node/Docker:** set `ENABLE_IN_PROCESS_SCHEDULER=true` and the server runs the worker itself.
- **Vercel Pro:** if you ever upgrade you can add a `vercel.json` with a `crons` list pointing at the same two routes.

It is safe to run several workers at once: a post is claimed atomically, so it can never be published twice, and a retry only
re-sends the accounts that failed.

## Testing

```bash
bun test                                             # unit + adapter tests (no network)
bun run dev                                          # in another terminal, then:
node --env-file=.env.local tests/e2e/scheduler.e2e.mjs   # engine, scheduler, retries, concurrency
node --env-file=.env.local tests/e2e/connect.e2e.mjs     # OAuth connect routes with a fake server
```

The e2e scripts use a throwaway user and local fake networks, and delete everything they create.
