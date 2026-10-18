import "server-only";
import { jwtVerify, SignJWT } from "jose";
import type { NextResponse } from "next/server";
import { newVerifier, randomToken } from "./pkce";

/**
 * OAuth "state" is kept in a short-lived, signed, HttpOnly cookie. It binds the callback to the
 * browser that started the flow and the signed-in user, and carries the PKCE verifier.
 */

export const OAUTH_COOKIE = "qs_oauth";
const MAX_AGE = 600;

export type OAuthState = {
  state: string;
  verifier: string;
  userId: string;
  platform: string;
  extra: Record<string, string>;
};

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

/** Creates the state + PKCE verifier and the signed cookie value that remembers them. */
export async function createOAuthState(input: {
  userId: string;
  platform: string;
  extra?: Record<string, string>;
}): Promise<{ payload: OAuthState; cookie: string }> {
  const payload: OAuthState = {
    state: randomToken(24),
    verifier: newVerifier(),
    userId: input.userId,
    platform: input.platform,
    extra: input.extra ?? {},
  };
  const cookie = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("oauth-state")
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  return { payload, cookie };
}

export function attachOAuthCookie(res: NextResponse, cookie: string) {
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // the provider redirects back with a top-level GET
    path: "/api/connect",
    maxAge: MAX_AGE,
  });
}

/** Validates the callback against the cookie. Returns the stored state or null. */
export async function readOAuth(
  cookie: string | undefined,
  input: { state: string | null; platform: string; userId: string },
): Promise<OAuthState | null> {
  if (!cookie || !input.state) return null;
  try {
    const { payload } = await jwtVerify(cookie, key(), { audience: "oauth-state" });
    const s = payload as unknown as OAuthState;
    if (s.state !== input.state || s.platform !== input.platform || s.userId !== input.userId) return null;
    return s;
  } catch {
    return null;
  }
}

export function redirectUri(platform: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/connect/${platform}/callback`;
}
