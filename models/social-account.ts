import { model, models, Schema, Types, type Model } from "mongoose";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

export interface ISocialAccount {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  platform: PlatformKey;
  externalId: string;
  handle: string;
  displayName: string;
  avatar?: string;
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  expiresAt?: Date;
  status: "active" | "expired" | "error";
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
    status: { type: String, enum: ["active", "expired", "error"], default: "active" },
  },
  { timestamps: true },
);
schema.index({ userId: 1, platform: 1, externalId: 1 }, { unique: true });

export const SocialAccount =
  (models.SocialAccount as Model<ISocialAccount>) ||
  model<ISocialAccount>("SocialAccount", schema);
