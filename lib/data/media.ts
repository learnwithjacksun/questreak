import "server-only";
import { connectDB } from "@/lib/db";
import { Media } from "@/models/media";
import { toMediaDTO } from "./serializers";

export async function listMedia(userId: string) {
  await connectDB();
  const items = await Media.find({ userId }).sort({ createdAt: -1 }).limit(500).lean();
  return items.map(toMediaDTO);
}
