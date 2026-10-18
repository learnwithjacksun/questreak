import "server-only";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";

/** Endpoints are overridable so tests can point the flow at a fake Google. */
export const GOOGLE = {
  authUrl: () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  userinfoUrl: () => process.env.GOOGLE_USERINFO_URL || "https://openidconnect.googleapis.com/v1/userinfo",
};

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
};

export class GoogleAuthError extends Error {}

/**
 * Finds or creates the Questreak user for a verified Google profile.
 *
 * Linking rule: the email on a Google account is verified by Google, so signing in with Google
 * proves ownership of that email and may attach to an existing account with the same email.
 *
 * Pre-hijacking guard: someone could register a victim's email with THEIR password and never
 * verify it. If the victim later signs in with Google, the account must not keep that password,
 * so an account whose email was never verified loses its password when Google verifies it.
 */
export async function userFromGoogleProfile(profile: GoogleProfile): Promise<{ id: string; firstVerification: boolean }> {
  if (!profile.email || !profile.email_verified) throw new GoogleAuthError("Google didn't confirm this email address.");
  await connectDB();
  const email = profile.email.toLowerCase();

  const existing = (await User.findOne({ googleId: profile.sub })) ?? (await User.findOne({ email }));
  if (existing) {
    if (existing.googleId && existing.googleId !== profile.sub) {
      throw new GoogleAuthError("This email is already linked to a different Google account.");
    }
    const firstVerification = !existing.emailVerified;
    if (firstVerification) existing.set("passwordHash", undefined);
    existing.googleId = profile.sub;
    existing.emailVerified = true;
    existing.avatar ??= profile.picture;
    await existing.save();
    return { id: String(existing._id), firstVerification };
  }

  try {
    const created = await User.create({
      name: (profile.given_name || profile.name || email.split("@")[0]).slice(0, 30),
      email,
      googleId: profile.sub,
      avatar: profile.picture,
      emailVerified: true,
    });
    return { id: String(created._id), firstVerification: true };
  } catch (err) {
    // Two sign-ins for the same new email raced: use the account that won.
    if ((err as { code?: number }).code === 11000) {
      const winner = await User.findOne({ email });
      if (winner) return { id: String(winner._id), firstVerification: false };
    }
    throw err;
  }
}
