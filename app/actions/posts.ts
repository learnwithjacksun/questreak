"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { postInputSchema, type PostInput } from "@/lib/validators/dashboard";
import { Media } from "@/models/media";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type SaveMode = "draft" | "schedule" | "publish";

export async function savePost(
  input: PostInput,
  mode: SaveMode,
): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, text, accountIds, mediaIds, scheduledFor } = parsed.data;

  if (mode !== "draft" && !text.trim() && mediaIds.length === 0) {
    return { ok: false, error: "Write something or attach media first." };
  }
  if (mode === "draft" && !text.trim() && mediaIds.length === 0) {
    return { ok: false, error: "A draft needs some text or media." };
  }

  await connectDB();

  const accounts = accountIds.length
    ? await SocialAccount.find({ _id: { $in: accountIds }, userId: user.id, status: "active" }).lean()
    : [];
  if (accounts.length !== accountIds.length) {
    return { ok: false, error: "One of the selected accounts is no longer connected." };
  }

  if (mode !== "draft") {
    if (accounts.length === 0) {
      return { ok: false, error: "Connect an account and select it to publish or schedule." };
    }
    if (mode === "publish") {
      // No platform adapters exist yet, so we never pretend a post went out.
      return { ok: false, error: "Publishing isn't available for the selected networks yet." };
    }
    if (!scheduledFor) return { ok: false, error: "Pick a date and time to schedule." };
    if (new Date(scheduledFor).getTime() < Date.now() + 60_000) {
      return { ok: false, error: "Choose a time at least a minute in the future." };
    }
  }

  const mediaDocs = mediaIds.length
    ? await Media.find({ _id: { $in: mediaIds }, userId: user.id }).lean()
    : [];
  const mediaById = new Map(mediaDocs.map((m) => [String(m._id), m]));
  const media = mediaIds
    .map((mid) => mediaById.get(mid))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ mediaId: m._id, url: m.url, resourceType: m.resourceType }));

  const doc = {
    text,
    media,
    targets: accounts.map((a) => ({
      accountId: a._id,
      platform: a.platform,
      status: "pending" as const,
    })),
    status: mode === "schedule" ? ("scheduled" as const) : ("draft" as const),
    scheduledFor: mode === "schedule" ? new Date(scheduledFor!) : undefined,
  };

  let postId: string;
  if (id) {
    const existing = await Post.findOne({ _id: id, userId: user.id });
    if (!existing) return { ok: false, error: "Post not found." };
    if (existing.status === "published") {
      return { ok: false, error: "Published posts can't be edited." };
    }
    existing.set(doc);
    if (mode !== "schedule") existing.scheduledFor = undefined;
    await existing.save();
    postId = String(existing._id);
  } else {
    const created = await Post.create({ ...doc, userId: user.id });
    postId = String(created._id);
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, id: postId };
}

export async function deletePost(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid post." };
  await connectDB();
  const res = await Post.deleteOne({ _id: id, userId: user.id });
  if (!res.deletedCount) return { ok: false, error: "Post not found." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function duplicatePost(id: string): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid post." };
  await connectDB();
  const src = await Post.findOne({ _id: id, userId: user.id }).lean();
  if (!src) return { ok: false, error: "Post not found." };
  const copy = await Post.create({
    userId: user.id,
    text: src.text,
    media: src.media,
    targets: src.targets.map((t) => ({ accountId: t.accountId, platform: t.platform, status: "pending" })),
    status: "draft",
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, id: String(copy._id) };
}

export async function unschedulePost(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid post." };
  await connectDB();
  const res = await Post.updateOne(
    { _id: id, userId: user.id, status: "scheduled" },
    { status: "draft", $unset: { scheduledFor: 1 } },
  );
  if (!res.modifiedCount) return { ok: false, error: "Only scheduled posts can be moved to drafts." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function reschedulePost(id: string, scheduledFor: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid post." };
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) {
    return { ok: false, error: "Choose a time at least a minute in the future." };
  }
  await connectDB();
  const res = await Post.updateOne(
    { _id: id, userId: user.id, status: "scheduled" },
    { scheduledFor: when },
  );
  if (!res.matchedCount) return { ok: false, error: "Only scheduled posts can be rescheduled." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
