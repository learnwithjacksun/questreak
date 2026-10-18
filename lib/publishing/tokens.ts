import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import type { ISocialAccount } from "@/models/social-account";
import { SocialAccount } from "@/models/social-account";
import { PROVIDERS } from "./registry";
import { PublishError, type AccountCtx, type ConnectedAccount } from "./types";

type AccountDoc = InstanceType<typeof SocialAccount>;

const DEFAULT_WINDOW = 5 * 60 * 1000;

export function toCtx(doc: Pick<ISocialAccount, "_id" | "userId" | "platform" | "externalId" | "handle" | "displayName" | "meta" | "accessTokenEnc" | "refreshTokenEnc" | "expiresAt">): AccountCtx {
  if (!doc.accessTokenEnc) throw new PublishError("This account has no saved credentials. Reconnect it.", { reconnect: true });
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    platform: doc.platform,
    externalId: doc.externalId,
    handle: doc.handle,
    displayName: doc.displayName,
    meta: (doc.meta ?? {}) as Record<string, unknown>,
    accessToken: decrypt(doc.accessTokenEnc),
    refreshToken: doc.refreshTokenEnc ? decrypt(doc.refreshTokenEnc) : undefined,
    expiresAt: doc.expiresAt ?? undefined,
  };
}

/**
 * Returns an account ready for an API call, refreshing its token first when it is about to
 * expire. An account whose token can't be renewed is marked "expired" so the UI asks the user
 * to reconnect.
 */
export async function freshAccount(doc: AccountDoc): Promise<AccountCtx> {
  const provider = PROVIDERS[doc.platform];
  const ctx = toCtx(doc);
  const window = provider.refreshWindowMs ?? DEFAULT_WINDOW;
  const expiresIn = doc.expiresAt ? doc.expiresAt.getTime() - Date.now() : Infinity;
  if (expiresIn > window) return ctx;

  const expired = expiresIn <= 0;
  try {
    if (!provider.refresh) throw new PublishError("Your connection expired. Reconnect the account.", { reconnect: true });
    const next = await provider.refresh(ctx);
    doc.accessTokenEnc = encrypt(next.accessToken);
    if (next.refreshToken) doc.refreshTokenEnc = encrypt(next.refreshToken);
    doc.expiresAt = next.expiresAt;
    if (next.refreshExpiresAt) doc.refreshExpiresAt = next.refreshExpiresAt;
    doc.status = "active";
    doc.lastError = undefined;
    await doc.save();
    return { ...ctx, accessToken: next.accessToken, refreshToken: next.refreshToken ?? ctx.refreshToken, expiresAt: next.expiresAt };
  } catch (err) {
    const e = err instanceof PublishError ? err : new PublishError("Couldn't refresh the connection.", { retryable: true });
    // A token that still works can be used while renewal is unavailable.
    if (!expired) return ctx;
    // Only a definite "needs reconnecting" answer flips the account; a network blip must not.
    if (e.reconnect) {
      doc.status = "expired";
      doc.lastError = e.message;
      await doc.save();
    }
    throw e;
  }
}

/** Upsert accounts discovered by a connect flow. Returns the stored ids. */
export async function saveConnected(userId: string, accounts: ConnectedAccount[]): Promise<string[]> {
  const ids: string[] = [];
  for (const a of accounts) {
    const doc = await SocialAccount.findOneAndUpdate(
      { userId, platform: a.platform, externalId: a.externalId },
      {
        $set: {
          handle: a.handle,
          displayName: a.displayName,
          avatar: a.avatar,
          accessTokenEnc: encrypt(a.accessToken),
          ...(a.refreshToken ? { refreshTokenEnc: encrypt(a.refreshToken) } : {}),
          expiresAt: a.expiresAt,
          refreshExpiresAt: a.refreshExpiresAt,
          scopes: a.scopes ?? [],
          status: "active",
          lastError: null,
          ...Object.fromEntries(Object.entries(a.meta ?? {}).map(([k, v]) => [`meta.${k}`, v])),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids.push(String(doc._id));
  }
  return ids;
}
