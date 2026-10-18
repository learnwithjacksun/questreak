import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/order";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";
import { toPostDTO } from "./serializers";

const DAY = 24 * 60 * 60 * 1000;

/** Local-day key (YYYY-MM-DD) in UTC; the client renders labels in the viewer's locale. */
export function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getOverview(userId: string) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY);
  const prevSince = new Date(now.getTime() - 60 * DAY);

  const [accounts, statusRows, publishedNow, publishedPrev, series, published, scheduled, activeOrders] =
    await Promise.all([
      SocialAccount.countDocuments({ userId: uid, status: "active" }),
      Post.aggregate<{ _id: string; n: number }>([
        { $match: { userId: uid } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Post.countDocuments({ userId: uid, status: "published", publishedAt: { $gte: since } }),
      Post.countDocuments({
        userId: uid,
        status: "published",
        publishedAt: { $gte: prevSince, $lt: since },
      }),
      Post.aggregate<{ _id: string; n: number }>([
        { $match: { userId: uid, status: "published", publishedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" } }, n: { $sum: 1 } } },
      ]),
      Post.find({ userId: uid, status: "published" }).sort({ publishedAt: -1 }).limit(8).lean(),
      Post.find({ userId: uid, status: "scheduled", scheduledFor: { $gte: now } })
        .sort({ scheduledFor: 1 })
        .limit(8)
        .lean(),
      Order.countDocuments({
        userId: uid,
        kind: "smm",
        status: { $in: ["pending_payment", "paid", "fulfilling"] },
      }),
    ]);

  const by = Object.fromEntries(statusRows.map((r) => [r._id, r.n]));
  const map = new Map(series.map((r) => [r._id, r.n]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * DAY);
    const key = dayKey(d);
    return { date: key, count: map.get(key) ?? 0 };
  });

  return {
    stats: {
      connectedAccounts: accounts,
      published: by.published ?? 0,
      scheduled: by.scheduled ?? 0,
      drafts: by.draft ?? 0,
      failed: by.failed ?? 0,
      activeBoosts: activeOrders,
      publishedDelta: publishedNow - publishedPrev,
      publishedLast30: publishedNow,
    },
    days,
    recent: {
      published: published.map(toPostDTO),
      scheduled: scheduled.map(toPostDTO),
    },
    totalPosts: Object.values(by).reduce((a, b) => a + b, 0),
  };
}
