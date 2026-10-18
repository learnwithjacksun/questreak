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
  if (sp.get("error")) {
    // The user pressed "Cancel" or the provider refused.
    return back({ error: "denied", platform, detail: sp.get("error_description") ?? sp.get("error") ?? "" });
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
