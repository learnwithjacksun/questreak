import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";
import { dayKey } from "./overview";

const DAY = 24 * 60 * 60 * 1000;

/** Activity analytics computed from our own post data (engagement needs platform APIs). */
export async function getAnalytics(userId: string, rangeDays: 7 | 30 | 90) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const since = new Date(now.getTime() - rangeDays * DAY);

  const [accounts, perDay, byPlatform, byStatus, byHour, totals] = await Promise.all([
    SocialAccount.countDocuments({ userId: uid }),
    Post.aggregate<{ _id: string; n: number }>([
      { $match: { userId: uid, status: "published", publishedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" } }, n: { $sum: 1 } } },
    ]),
    Post.aggregate<{ _id: string; n: number }>([
      { $match: { userId: uid, createdAt: { $gte: since } } },
      { $unwind: "$targets" },
      { $group: { _id: "$targets.platform", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    Post.aggregate<{ _id: string; n: number }>([
      { $match: { userId: uid, createdAt: { $gte: since } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Post.aggregate<{ _id: { dow: number; hour: number }; n: number }>([
      { $match: { userId: uid, status: "published", publishedAt: { $gte: since } } },
      {
        $group: {
          _id: { dow: { $dayOfWeek: "$publishedAt" }, hour: { $hour: "$publishedAt" } },
          n: { $sum: 1 },
        },
      },
    ]),
    Post.aggregate<{ _id: null; posts: number; targets: number; failedTargets: number }>([
      { $match: { userId: uid, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          posts: { $sum: 1 },
          targets: { $sum: { $size: "$targets" } },
          failedTargets: {
            $sum: {
              $size: {
                $filter: { input: "$targets", as: "t", cond: { $eq: ["$$t.status", "failed"] } },
              },
            },
          },
        },
      },
    ]),
  ]);

  const dayMap = new Map(perDay.map((r) => [r._id, r.n]));
  const days = Array.from({ length: rangeDays }, (_, i) => {
    const key = dayKey(new Date(now.getTime() - (rangeDays - 1 - i) * DAY));
    return { date: key, count: dayMap.get(key) ?? 0 };
  });

  // 7 (Sun..Sat) x 24 grid, UTC based.
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of byHour) heat[r._id.dow - 1][r._id.hour] = r.n;

  const t = totals[0] ?? { posts: 0, targets: 0, failedTargets: 0 };
  return {
    accounts,
    days,
    byPlatform: byPlatform.map((r) => ({ platform: r._id, count: r.n })),
    byStatus: byStatus.map((r) => ({ status: r._id, count: r.n })),
    heat,
    totals: {
      posts: t.posts,
      deliveries: t.targets,
      successRate:
        t.targets > 0 ? Math.round(((t.targets - t.failedTargets) / t.targets) * 100) : null,
    },
  };
}
