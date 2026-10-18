"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import type { PlatformKey } from "@/lib/platforms";
import { connectBluesky } from "@/lib/publishing/providers/bluesky";
import { listBoards, type PinterestBoard } from "@/lib/publishing/providers/pinterest";
import { fetchCreatorInfo, tiktokAudited, type CreatorInfo } from "@/lib/publishing/providers/tiktok";
import { freshAccount, saveConnected } from "@/lib/publishing/tokens";
import { PublishError } from "@/lib/publishing/types";
import { SocialAccount } from "@/models/social-account";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const messageOf = (err: unknown, fallback: string) => (err instanceof PublishError ? err.message : fallback);

const blueskySchema = z.object({
  identifier: z.string().trim().min(3, "Enter your Bluesky handle, like you.bsky.social"),
  appPassword: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i, "That doesn't look like an app password (xxxx-xxxx-xxxx-xxxx)"),
  pds: z.string().trim().max(200).optional(),
});

/** Bluesky connects with a handle + app password instead of a redirect. */
export async function connectBlueskyAccount(input: z.input<typeof blueskySchema>): Promise<Result<{ handle: string }>> {
  const user = await getCurrentUser();
  const parsed = blueskySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const account = await connectBluesky(parsed.data);
    await connectDB();
    await saveConnected(user.id, [account]);
    revalidatePath("/dashboard", "layout");
    return { ok: true, handle: account.handle };
  } catch (err) {
    if (!(err instanceof PublishError)) console.error("[connect/bluesky]", err);
    return { ok: false, error: messageOf(err, "Couldn't connect to Bluesky. Check the handle and app password.") };
  }
}

async function ownedAccount(userId: string, accountId: string, platform: PlatformKey) {
  if (!Types.ObjectId.isValid(accountId)) return null;
  await connectDB();
  return SocialAccount.findOne({ _id: accountId, userId, platform });
}

/** TikTok's posting rules depend on the creator (allowed visibility, interaction settings...). */
export async function getTikTokCreatorInfo(accountId: string): Promise<Result<{ info: CreatorInfo; audited: boolean }>> {
  const user = await getCurrentUser();
  const doc = await ownedAccount(user.id, accountId, "tiktok");
  if (!doc) return { ok: false, error: "TikTok account not found." };
  try {
    const ctx = await freshAccount(doc);
    return { ok: true, info: await fetchCreatorInfo(ctx.accessToken), audited: tiktokAudited() };
  } catch (err) {
    return { ok: false, error: messageOf(err, "Couldn't load this TikTok account's settings.") };
  }
}

export async function getPinterestBoards(accountId: string): Promise<Result<{ boards: PinterestBoard[]; selected?: string }>> {
  const user = await getCurrentUser();
  const doc = await ownedAccount(user.id, accountId, "pinterest");
  if (!doc) return { ok: false, error: "Pinterest account not found." };
  try {
    const ctx = await freshAccount(doc);
    return { ok: true, boards: await listBoards(ctx.accessToken), selected: doc.meta?.boardId as string | undefined };
  } catch (err) {
    return { ok: false, error: messageOf(err, "Couldn't load your Pinterest boards.") };
  }
}

/** The board used when a post doesn't pick one. */
export async function setPinterestBoard(accountId: string, boardId: string): Promise<Result> {
  const user = await getCurrentUser();
  const doc = await ownedAccount(user.id, accountId, "pinterest");
  if (!doc) return { ok: false, error: "Pinterest account not found." };
  if (!/^[\w-]{1,64}$/.test(boardId)) return { ok: false, error: "Invalid board." };
  doc.set("meta.boardId", boardId);
  doc.markModified("meta");
  await doc.save();
  revalidatePath("/dashboard/accounts");
  return { ok: true };
}
