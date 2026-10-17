import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { createSession } from "@/lib/session";
import { User } from "@/models/user";

type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
};

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL!;
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, appUrl));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("g_state")?.value;
  if (!code || !state || state !== savedState) return fail("google_failed");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google_failed");
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!profileRes.ok) return fail("google_failed");
  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.email || !profile.email_verified) return fail("google_failed");

  await connectDB();
  const email = profile.email.toLowerCase();
  const user =
    (await User.findOne({ googleId: profile.sub })) ??
    (await User.findOne({ email }));

  let userId: string;
  if (user) {
    user.googleId = profile.sub;
    user.emailVerified = true;
    user.avatar ??= profile.picture;
    await user.save();
    userId = String(user._id);
  } else {
    const created = await User.create({
      name: profile.given_name || profile.name || email.split("@")[0],
      email,
      googleId: profile.sub,
      avatar: profile.picture,
      emailVerified: true,
    });
    userId = String(created._id);
  }

  await createSession(userId);
  const res = NextResponse.redirect(new URL("/dashboard", appUrl));
  res.cookies.delete("g_state");
  return res;
}
