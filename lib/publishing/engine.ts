import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import type { PlatformKey } from "@/lib/platforms";
import { Post, type PostStatus } from "@/models/post";
import { SocialAccount } from "@/models/social-account";
import { validateForPlatform } from "./capabilities";
import { PROVIDERS } from "./registry";
import { freshAccount } from "./tokens";
import { PublishError, type PublishInput } from "./types";

export type TargetResult = {
  accountId: string;
  platform: PlatformKey;
  ok: boolean;
  error?: string;
  url?: string;
  note?: string;
};

export type PublishOutcome = {
  ok: boolean;
  status: PostStatus;
  results: TargetResult[];
  /** Set when nothing could be attempted (post missing, already publishing...). */
  error?: string;
};

const STALE_MS = 20 * 60 * 1000;
const CONCURRENCY = 3;

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Sends a post to every target that hasn't been published yet.
 *
 * The post is claimed atomically (draft/scheduled/failed -> publishing) so two workers, or a
 * double click, can never publish it twice. Each target's result is written as soon as it
 * finishes, so a crash mid-run keeps everything that already went out. Retrying a failed post
 * only resends the targets that failed.
 */
export async function publishPostNow(postId: string, opts: { userId?: string } = {}): Promise<PublishOutcome> {
  await connectDB();
  if (!Types.ObjectId.isValid(postId)) return { ok: false, status: "failed", results: [], error: "Invalid post." };

  const post = await Post.findOneAndUpdate(
    {
      _id: postId,
      ...(opts.userId ? { userId: opts.userId } : {}),
      status: { $in: ["draft", "scheduled", "failed"] },
    },
    { status: "publishing", publishStartedAt: new Date() },
    { returnDocument: "after" },
  );
  if (!post) {
    return { ok: false, status: "failed", results: [], error: "This post can't be published right now (it may already be publishing or published)." };
  }

  const pending = post.targets.filter((t) => t.status !== "published");
  const results: TargetResult[] = [];

  const setTarget = (accountId: string, set: Record<string, unknown>, inc = false) =>
    Post.updateOne(
      { _id: post._id },
      {
        $set: Object.fromEntries(Object.entries(set).map(([k, v]) => [`targets.$[t].${k}`, v])),
        ...(inc ? { $inc: { "targets.$[t].attempts": 1 } } : {}),
      },
      { arrayFilters: [{ "t.accountId": new Types.ObjectId(accountId) }] },
    );

  if (pending.length === 0) {
    post.status = "failed";
    await post.save();
    return { ok: false, status: "failed", results, error: "This post has no accounts selected." };
  }

  const media = post.media.map((m) => ({ url: m.url, type: m.resourceType }));

  const runs = await pool(pending, CONCURRENCY, async (target): Promise<TargetResult> => {
    const accountId = String(target.accountId);
    const base = { accountId, platform: target.platform };
    try {
      const doc = await SocialAccount.findOne({ _id: target.accountId, userId: post.userId });
      if (!doc) throw new PublishError("This account was disconnected.", { reconnect: true });
      if (doc.status === "expired") throw new PublishError(doc.lastError || "This account needs to be reconnected.", { reconnect: true });

      const metaLimit = typeof doc.meta?.maxChars === "number" ? (doc.meta.maxChars as number) : undefined;
      const problems = validateForPlatform(doc.platform, post.text, media.map((m) => ({ resourceType: m.type })), metaLimit);
      if (problems.length) throw new PublishError(problems.join(" "));

      const account = await freshAccount(doc);
      const input: PublishInput = {
        text: post.text,
        media,
        options: (post.options ?? {}) as PublishInput["options"],
        accountId,
      };
      const res = await PROVIDERS[doc.platform].publish(account, input);

      await setTarget(
        accountId,
        {
          status: "published",
          error: null,
          needsReconnect: false,
          externalId: res.externalId ?? null,
          externalUrl: res.url ?? null,
          publishedAt: new Date(),
        },
        true,
      );
      await SocialAccount.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date(), lastError: null } });
      return { ...base, ok: true, url: res.url, note: res.note };
    } catch (err) {
      const e = err instanceof PublishError ? err : new PublishError(err instanceof Error ? err.message : "Unexpected error.");
      if (!(err instanceof PublishError)) console.error(`[publish] ${target.platform} unexpected error:`, err);
      await setTarget(accountId, { status: "failed", error: e.message, needsReconnect: e.reconnect }, true);
      if (e.reconnect) {
        await SocialAccount.updateOne({ _id: target.accountId }, { $set: { status: "expired", lastError: e.message } });
      }
      return { ...base, ok: false, error: e.message };
    }
  });
  results.push(...runs);

  const fresh = await Post.findById(post._id);
  const allPublished = !!fresh && fresh.targets.length > 0 && fresh.targets.every((t) => t.status === "published");
  const status: PostStatus = allPublished ? "published" : "failed";
  await Post.updateOne(
    { _id: post._id },
    { status, ...(allPublished ? { publishedAt: new Date() } : {}), $unset: { publishStartedAt: 1 } },
  );
  return { ok: allPublished, status, results };
}

/** Publishes every scheduled post that is due. Safe to call from several workers at once. */
export async function processDuePosts(limit = 10) {
  await connectDB();

  // A run that died mid-way leaves "publishing" behind; fail it so the user can retry.
  const stale = await Post.find({ status: "publishing", publishStartedAt: { $lt: new Date(Date.now() - STALE_MS) } }).select("_id");
  for (const p of stale) {
    await Post.updateOne(
      { _id: p._id },
      {
        status: "failed",
        $set: { "targets.$[t].status": "failed", "targets.$[t].error": "Publishing timed out. Retry to send it again." },
        $unset: { publishStartedAt: 1 },
      },
      { arrayFilters: [{ "t.status": "pending" }] },
    );
  }

  const due = await Post.find({ status: "scheduled", scheduledFor: { $lte: new Date() } })
    .sort({ scheduledFor: 1 })
    .limit(limit)
    .select("_id")
    .lean();

  const outcomes = await pool(due, 2, (p) => publishPostNow(String(p._id)));
  return {
    due: due.length,
    published: outcomes.filter((o) => o.status === "published").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    recovered: stale.length,
  };
}

/** Renews tokens that are close to expiring so scheduled posts don't hit a dead token. */
export async function refreshExpiringAccounts() {
  await connectDB();
  const horizon = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
  const docs = await SocialAccount.find({ status: "active", expiresAt: { $lte: horizon } }).limit(200);
  let refreshed = 0;
  let failed = 0;
  for (const doc of docs) {
    const before = doc.expiresAt?.getTime();
    try {
      await freshAccount(doc);
      if (doc.expiresAt?.getTime() !== before) refreshed++;
    } catch {
      failed++;
    }
  }
  return { checked: docs.length, refreshed, failed };
}
