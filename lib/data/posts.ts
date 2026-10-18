import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/lib/db";
import type { PlatformKey } from "@/lib/platforms";
import { Post, type IPost } from "@/models/post";
import { toPostDTO } from "./serializers";
import type { PostDTO } from "./types";

export type PostFilters = {
  status: "all" | "published" | "scheduled" | "draft" | "failed";
  platform: string;
  q: string;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function baseFilter(userId: string, f: Pick<PostFilters, "platform" | "q">) {
  const filter: QueryFilter<IPost> = { userId: new Types.ObjectId(userId) };
  if (f.platform !== "all") filter["targets.platform"] = f.platform as PlatformKey;
  if (f.q) filter.text = { $regex: escape(f.q), $options: "i" };
  return filter;
}

export async function listPosts(userId: string, f: PostFilters) {
  await connectDB();
  const filter = baseFilter(userId, f);
  if (f.status !== "all") filter.status = f.status;

  const sortField = f.status === "scheduled" ? "scheduledFor" : "updatedAt";
  const dir = f.sort === "oldest" ? 1 : -1;

  const [items, total] = await Promise.all([
    Post.find(filter)
      .sort({ [sortField]: dir })
      .skip((f.page - 1) * f.pageSize)
      .limit(f.pageSize)
      .lean(),
    Post.countDocuments(filter),
  ]);

  return {
    items: items.map(toPostDTO),
    total,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** Counts per status for the tab badges (respecting platform/search filters). */
export async function postCounts(userId: string, f: Pick<PostFilters, "platform" | "q">) {
  await connectDB();
  const rows = await Post.aggregate<{ _id: string; n: number }>([
    { $match: baseFilter(userId, f) },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const published = by.published ?? 0;
  const scheduled = by.scheduled ?? 0;
  const draft = by.draft ?? 0;
  const failed = by.failed ?? 0;
  return {
    all: published + scheduled + draft + failed + (by.publishing ?? 0),
    published,
    scheduled,
    draft,
    failed,
  };
}

export async function getPost(userId: string, id: string): Promise<PostDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const post = await Post.findOne({ _id: id, userId }).lean();
  return post ? toPostDTO(post) : null;
}

export async function postsInRange(userId: string, from: Date, to: Date) {
  await connectDB();
  const posts = await Post.find({
    userId,
    $or: [
      { scheduledFor: { $gte: from, $lt: to } },
      { publishedAt: { $gte: from, $lt: to } },
    ],
  })
    .sort({ scheduledFor: 1 })
    .limit(500)
    .lean();
  return posts.map(toPostDTO);
}
