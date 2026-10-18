import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { isPlatformKey } from "@/lib/platforms";
import { OAUTH_COOKIE, readOAuth, redirectUri } from "@/lib/publishing/oauth";
import { connectProvider } from "@/lib/publishing/registry";
import { saveConnected } from "@/lib/publishing/tokens";
import { PublishError } from "@/lib/publishing/types";
import { getSessionUserId } from "@/lib/session";

export const maxDuration = 60;

/** Receives the provider's redirect, exchanges the code and stores the connected accounts. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const back = (q: Record<string, string>) => {
    const url = new URL("/dashboard/accounts", req.nextUrl.origin);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/connect" });
    return res;
  };

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  if (!isPlatformKey(platform)) return back({ error: "unknown_platform" });

  const sp = req.nextUrl.searchParams;
  const providerError = sp.get("error");
  if (providerError) {
    // A real "Cancel" is quiet; anything else (bad scope, unregistered redirect...) must show the reason.
    const cancelled = ["access_denied", "user_cancelled_login", "user_cancelled_authorize"].includes(providerError);
    const reason = sp.get("error_description") ?? providerError;
    if (!cancelled) console.error(`[connect/${platform}] provider returned an error: ${providerError}: ${reason}`);
    return back({ error: cancelled ? "denied" : "failed", platform, detail: cancelled ? reason : `${reason} (${providerError})` });
  }

  const provider = connectProvider(platform);
  const saved = await readOAuth(req.cookies.get(OAUTH_COOKIE)?.value, { state: sp.get("state"), platform: provider.key, userId });
  const code = sp.get("code");
  if (!saved || !code || !provider.exchange) return back({ error: "invalid_state", platform });

  try {
    const accounts = await provider.exchange({ code, redirectUri: redirectUri(provider.key), verifier: saved.verifier, extra: saved.extra });
    await connectDB();
    const ids = await saveConnected(userId, accounts);
    return back({ connected: platform, count: String(ids.length) });
  } catch (err) {
    const message = err instanceof PublishError ? err.message : "Something went wrong while connecting.";
    if (!(err instanceof PublishError)) console.error(`[connect/${platform}] exchange failed:`, err);
    return back({ error: "failed", platform, detail: message });
  }
}
