import { NextResponse, type NextRequest } from "next/server";
import { isPlatformKey } from "@/lib/platforms";
import { attachOAuthCookie, createOAuthState, redirectUri } from "@/lib/publishing/oauth";
import { connectProvider, missingEnv } from "@/lib/publishing/registry";
import { PublishError } from "@/lib/publishing/types";
import { getSessionUserId } from "@/lib/session";

const accounts = (req: NextRequest, params: Record<string, string>) => {
  const url = new URL("/dashboard/accounts", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
};

/** Starts a network's sign-in: redirects the browser to the provider's authorize page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  if (!isPlatformKey(platform)) return accounts(req, { error: "unknown_platform" });

  const provider = connectProvider(platform);
  const missing = missingEnv(provider.key);
  if (missing.length) return accounts(req, { error: "not_configured", platform });
  if (!provider.authorize) return accounts(req, { error: "unsupported", platform });

  const extra: Record<string, string> = {};
  const instance = req.nextUrl.searchParams.get("instance");
  if (instance) extra.instance = instance;

  const { payload, cookie } = await createOAuthState({ userId, platform: provider.key, extra });

  try {
    const url = await provider.authorize({ redirectUri: redirectUri(provider.key), state: payload.state, verifier: payload.verifier, extra });
    const res = NextResponse.redirect(url);
    attachOAuthCookie(res, cookie);
    return res;
  } catch (err) {
    const message = err instanceof PublishError ? err.message : "Couldn't start the connection.";
    if (!(err instanceof PublishError)) console.error(`[connect/${platform}] start failed:`, err);
    return accounts(req, { error: "failed", platform, detail: message });
  }
}
