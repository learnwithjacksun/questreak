import { randomBytes } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { GOOGLE } from "@/lib/google-auth";

/** Starts "Continue with Google": sends the browser to Google's consent screen. */
export async function GET() {
  await connection();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !appUrl) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", appUrl ?? "http://localhost:3000"));
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL(GOOGLE.authUrl());
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    // Sign-in only needs identity. YouTube permissions are requested separately, when connecting a channel.
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
