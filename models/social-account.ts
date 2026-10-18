import { model, models, Schema, Types, type Model } from "mongoose";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

export interface ISocialAccount {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  platform: PlatformKey;
  /** Stable id on the network (page id, DID, member id, "user@instance"...). */
  externalId: string;
  handle: string;
  displayName: string;
  avatar?: string;
  /** AES-256-GCM encrypted. For Bluesky this holds the app password. */
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
  scopes?: string[];
  /** Network-specific data: { pageId, instance, pds, boardId, channelId, personUrn... }. */
  meta?: Record<string, unknown>;
  status: "active" | "expired" | "error";
  lastError?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISocialAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    platform: { type: String, enum: PLATFORM_KEYS, required: true },
    externalId: { type: String, required: true },
    handle: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: String,
    accessTokenEnc: String,
    refreshTokenEnc: String,
    expiresAt: Date,
    refreshExpiresAt: Date,
    scopes: [String],
    meta: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["active", "expired", "error"], default: "active" },
    lastError: String,
    lastUsedAt: Date,
  },
  { timestamps: true },
);
schema.index({ userId: 1, platform: 1, externalId: 1 }, { unique: true });
schema.index({ status: 1, expiresAt: 1 });

export const SocialAccount =
  (models.SocialAccount as Model<ISocialAccount>) ||
  model<ISocialAccount>("SocialAccount", schema);
