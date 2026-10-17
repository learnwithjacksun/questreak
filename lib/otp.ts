import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { connectDB } from "./db";
import { sendOtpEmail } from "./mail";
import { Otp, type OtpPurpose } from "@/models/otp";

const TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

type Result = { ok: true } | { ok: false; error: string };

function hash(email: string, purpose: OtpPurpose, code: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`${purpose}:${email}:${code}`)
    .digest("hex");
}

export async function issueOtp(
  email: string,
  purpose: OtpPurpose = "verify",
): Promise<Result> {
  await connectDB();
  const existing = await Otp.findOne({ email, purpose });
  if (existing) {
    const wait = COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
    if (wait > 0) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(wait / 1000)}s before requesting a new code.`,
      };
    }
  }
  const code = String(randomInt(0, 100000)).padStart(5, "0");
  await Otp.findOneAndUpdate(
    { email, purpose },
    {
      codeHash: hash(email, purpose, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + TTL_MS),
      lastSentAt: new Date(),
    },
    { upsert: true },
  );
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (err) {
    console.error("[otp] could not send email:", err);
    // Drop the code so the user can retry immediately instead of waiting out the cooldown.
    await Otp.deleteOne({ email, purpose });
    return {
      ok: false,
      error: "We couldn't send the email right now. Please try again shortly.",
    };
  }
  return { ok: true };
}

export async function checkOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = "verify",
): Promise<Result> {
  await connectDB();
  const otp = await Otp.findOne({ email, purpose });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Request a new one." };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }
  const a = Buffer.from(hash(email, purpose, code));
  const b = Buffer.from(otp.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await Otp.updateOne({ email, purpose }, { $inc: { attempts: 1 } });
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  await Otp.deleteOne({ email, purpose });
  return { ok: true };
}
