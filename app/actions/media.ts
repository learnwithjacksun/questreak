"use server";

import { v2 as cloudinary } from "cloudinary";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Media } from "@/models/media";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function configure() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return false;
  cloudinary.config({ cloud_name: cloud, api_key: key, api_secret: secret, secure: true });
  return true;
}

const recordSchema = z.object({
  publicId: z.string().min(1),
  url: z.string().url(),
  resourceType: z.enum(["image", "video"]),
  format: z.string().optional(),
  bytes: z.number().nonnegative(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  name: z.string().min(1).max(200),
});

/** Called after a successful direct browser upload to Cloudinary. */
export async function recordMedia(input: z.input<typeof recordSchema>): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload." };
  // Only accept assets inside this user's folder, so one user can't register another's files.
  if (!parsed.data.publicId.startsWith(`questreak/${user.id}/`)) {
    return { ok: false, error: "Invalid upload." };
  }
  await connectDB();
  const doc = await Media.create({ ...parsed.data, userId: user.id });
  revalidatePath("/dashboard/media");
  return { ok: true, id: String(doc._id) };
}

export async function deleteMedia(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid file." };
  await connectDB();
  const doc = await Media.findOne({ _id: id, userId: user.id });
  if (!doc) return { ok: false, error: "File not found." };
  if (configure()) {
    await cloudinary.uploader
      .destroy(doc.publicId, { resource_type: doc.resourceType })
      .catch(() => undefined);
  }
  await doc.deleteOne();
  revalidatePath("/dashboard/media");
  return { ok: true };
}
