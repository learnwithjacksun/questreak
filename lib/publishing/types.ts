import type { PlatformKey } from "@/lib/platforms";
import type { PostOptions } from "@/models/post";

export type PublishMedia = { url: string; type: "image" | "video" };

export type PublishInput = {
  text: string;
  media: PublishMedia[];
  options: PostOptions;
  /** Social account id this publish is for (TikTok options are keyed by it). */
  accountId: string;
};

export type PublishResult = {
  /** Network post id. */
  externalId?: string;
  /** Public link to the post when the network gives one. */
  url?: string;
  /** Extra info, e.g. "TikTok is still processing the video". */
  note?: string;
};

/** A connected account with its tokens decrypted and refreshed, ready for an API call. */
export type AccountCtx = {
  id: string;
  userId: string;
  platform: PlatformKey;
  externalId: string;
  handle: string;
  displayName: string;
  meta: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
};

/** An account discovered during connect, ready to be stored. */
export type ConnectedAccount = TokenSet & {
  platform: PlatformKey;
  externalId: string;
  handle: string;
  displayName: string;
  avatar?: string;
  scopes?: string[];
  meta?: Record<string, unknown>;
};

export type AuthorizeCtx = {
  redirectUri: string;
  state: string;
  /** PKCE verifier (also usable as a nonce). */
  verifier: string;
  extra: Record<string, string>;
};

export type ExchangeCtx = {
  code: string;
  redirectUri: string;
  verifier: string;
  extra: Record<string, string>;
};

export interface Provider {
  key: PlatformKey;
  /** Env vars that must be set for this network to be connectable. */
  env: string[];
  /** Another provider whose connect flow also creates this network's accounts (Instagram via Meta). */
  connectVia?: PlatformKey;
  /** Build the sign-in URL. Absent for credential-based networks (Bluesky). */
  authorize?(ctx: AuthorizeCtx): Promise<string> | string;
  /** Turn the callback `code` into one or more accounts. */
  exchange?(ctx: ExchangeCtx): Promise<ConnectedAccount[]>;
  /** Send a post. Throw `PublishError` on failure. */
  publish(account: AccountCtx, input: PublishInput): Promise<PublishResult>;
  /** Exchange a refresh token (or extend a long-lived token). */
  refresh?(account: AccountCtx): Promise<TokenSet>;
  /** Refresh proactively once the token has this long left (ms). Default 5 minutes. */
  refreshWindowMs?: number;
}

export class PublishError extends Error {
  /** The account's token is invalid or expired; the user must reconnect. */
  reconnect: boolean;
  /** Worth retrying later (rate limit, outage). */
  retryable: boolean;
  constructor(message: string, opts: { reconnect?: boolean; retryable?: boolean } = {}) {
    super(message);
    this.name = "PublishError";
    this.reconnect = opts.reconnect ?? false;
    this.retryable = opts.retryable ?? false;
  }
}
