"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { destroySession } from "@/lib/session";
import {
  changePasswordSchema,
  deleteAccountSchema,
  notificationPrefsSchema,
  profileSchema,
  type ChangePasswordInput,
  type ProfileInput,
} from "@/lib/validators/dashboard";
import { Media } from "@/models/media";
import { Order } from "@/models/order";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";
import { User } from "@/models/user";

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fields(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function updateProfile(input: ProfileInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the errors below.", fieldErrors: fields(parsed.error.issues) };
  }
  await connectDB();
  await User.updateOne(
    { _id: user.id },
    { name: parsed.data.name, avatar: parsed.data.avatar || undefined },
  );
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function changePassword(input: ChangePasswordInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the errors below.", fieldErrors: fields(parsed.error.issues) };
  }
  await connectDB();
  const doc = await User.findById(user.id);
  if (!doc) return { ok: false, error: "Account not found." };

  // Google-only accounts have no password yet, so they can set one without a current password.
  if (doc.passwordHash) {
    const ok =
      !!parsed.data.currentPassword &&
      (await bcrypt.compare(parsed.data.currentPassword, doc.passwordHash));
    if (!ok) {
      return {
        ok: false,
        error: "Your current password is incorrect.",
        fieldErrors: { currentPassword: "Incorrect password" },
      };
    }
  }
  doc.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await doc.save();
  return { ok: true };
}

export async function updateNotificationPrefs(input: {
  productUpdates: boolean;
  publishAlerts: boolean;
  orderUpdates: boolean;
}): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preferences." };
  await connectDB();
  await User.updateOne({ _id: user.id }, { notificationPrefs: parsed.data });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteAccount(input: { password?: string; confirm: string }): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  await connectDB();
  const doc = await User.findById(user.id);
  if (!doc) return { ok: false, error: "Account not found." };
  if (doc.passwordHash) {
    const ok = !!parsed.data.password && (await bcrypt.compare(parsed.data.password, doc.passwordHash));
    if (!ok) return { ok: false, error: "Incorrect password." };
  }

  await Promise.all([
    Post.deleteMany({ userId: user.id }),
    Media.deleteMany({ userId: user.id }),
    SocialAccount.deleteMany({ userId: user.id }),
    // Keep order records for bookkeeping but detach nothing sensitive: delivered credentials are wiped.
    Order.updateMany({ userId: user.id }, { $set: { deliveredEnc: [] } }),
    User.deleteOne({ _id: user.id }),
  ]);
  await destroySession();
  redirect("/");
}
