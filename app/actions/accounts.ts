"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";

export async function disconnectAccount(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid account." };
  await connectDB();
  const res = await SocialAccount.deleteOne({ _id: id, userId: user.id });
  if (!res.deletedCount) return { ok: false, error: "Account not found." };
  // Scheduled posts that targeted it fall back to drafts instead of failing silently later.
  await Post.updateMany(
    { userId: user.id, status: "scheduled", "targets.accountId": id },
    { status: "draft", $unset: { scheduledFor: 1 } },
  );
  await Post.updateMany({ userId: user.id }, { $pull: { targets: { accountId: id } } });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
