"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/mail";
import { checkOtp, issueOtp } from "@/lib/otp";
import { createSession, destroySession } from "@/lib/session";
import {
  forgotSchema,
  otpSchema,
  resetSchema,
  type ResetInput,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validators/auth";
import { User } from "@/models/user";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function verifyUrl(email: string) {
  return `/verify?email=${encodeURIComponent(email)}`;
}

export async function signUp(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
    return { ok: false, error: "Please fix the errors below.", fieldErrors };
  }
  const { name, email, password } = parsed.data;

  await connectDB();
  const existing = await User.findOne({ email });
  if (existing?.emailVerified) {
    return {
      ok: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: "Already registered. Try signing in." },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.findOneAndUpdate(
    { email },
    { name, email, passwordHash, emailVerified: false },
    { upsert: true },
  );

  const sent = await issueOtp(email);
  // A cooldown hit on an unverified re-signup just means a code was sent recently.
  if (!sent.ok && !sent.error.startsWith("Please wait")) {
    return { ok: false, error: sent.error };
  }
  redirect(verifyUrl(email));
}

export async function signIn(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }
  const { email, password } = parsed.data;

  await connectDB();
  const user = await User.findOne({ email });
  const valid =
    !!user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) {
    return { ok: false, error: "Incorrect email or password." };
  }

  if (!user.emailVerified) {
    const sent = await issueOtp(email);
    if (!sent.ok && !sent.error.startsWith("Please wait")) {
      return { ok: false, error: sent.error };
    }
    redirect(verifyUrl(email));
  }

  await createSession(String(user._id));
  redirect("/dashboard");
}

export async function verifyOtp(input: {
  email: string;
  code: string;
}): Promise<ActionResult> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter the 5-digit code." };
  }
  const { email, code } = parsed.data;

  const result = await checkOtp(email, code);
  if (!result.ok) return result;

  // Returns the document as it was BEFORE the update, so we can tell a first-time verification.
  const user = await User.findOneAndUpdate({ email }, { emailVerified: true });
  if (!user) return { ok: false, error: "Account not found. Sign up again." };

  if (!user.emailVerified) {
    // Best effort: a failed welcome email must never block the user from getting in.
    try {
      await sendWelcomeEmail(email, user.name);
    } catch (err) {
      console.error("[auth] welcome email failed:", err);
    }
  }

  await createSession(String(user._id));
  redirect("/dashboard");
}

export async function resendOtp(email: string): Promise<ActionResult> {
  const parsed = otpSchema.shape.email.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email." };

  await connectDB();
  const user = await User.findOne({ email: parsed.data });
  // Don't reveal whether the account exists.
  if (!user || user.emailVerified) return { ok: true };
  return issueOtp(parsed.data);
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const sent = await sendResetCode(parsed.data.email);
  // Same response whether or not the account exists, to avoid leaking accounts.
  if (!sent.ok && !sent.error.startsWith("Please wait")) return sent;
  redirect(`/reset-password?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function resendResetCode(email: string): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Invalid email." };
  return sendResetCode(parsed.data.email);
}

async function sendResetCode(email: string): Promise<ActionResult> {
  await connectDB();
  const user = await User.findOne({ email });
  if (!user || !user.emailVerified) return { ok: true };
  return issueOtp(email, "reset");
}

export async function resetPassword(input: ResetInput): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
    return { ok: false, error: "Please fix the errors below.", fieldErrors };
  }
  const { email, code, password } = parsed.data;

  const result = await checkOtp(email, code, "reset");
  if (!result.ok) return result;

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email },
    { passwordHash, emailVerified: true },
  );
  if (!user) return { ok: false, error: "Account not found." };

  redirect("/login?passwordReset=1");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
