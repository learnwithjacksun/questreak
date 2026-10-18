import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE, GoogleAuthError, userFromGoogleProfile, type GoogleProfile } from "@/lib/google-auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { createSession } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL!;
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, appUrl));
    res.cookies.delete("g_state");
    return res;
  };
  const fail = (code: string) => to(`/login?error=${code}`);

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) {
    // Closing the Google window or pressing "Cancel" is not an error worth shouting about.
    return fail(sp.get("error") === "access_denied" ? "google_cancelled" : "google_failed");
  }

  const code = sp.get("code");
  const state = sp.get("state");
  const savedState = req.cookies.get("g_state")?.value;
  if (!code || !state || state !== savedState) return fail("google_failed");

  try {
    const tokenRes = await fetch(GOOGLE.tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) return fail("google_failed");
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch(GOOGLE.userinfoUrl(), {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileRes.ok) return fail("google_failed");
    const profile = (await profileRes.json()) as GoogleProfile;

    const { id, firstVerification } = await userFromGoogleProfile(profile);

    if (firstVerification) {
      // Best effort: a failed welcome email must never block signing in.
      try {
        await connectDB();
        const user = await User.findById(id).select("name email").lean();
        if (user) await sendWelcomeEmail(user.email, user.name);
      } catch (err) {
        console.error("[auth] welcome email failed:", err);
      }
    }

    await createSession(id);
    return to("/dashboard");
  } catch (err) {
    if (!(err instanceof GoogleAuthError)) console.error("[auth/google] sign-in failed:", err);
    return fail("google_failed");
  }
}
