import { model, models, Schema, Types, type Model } from "mongoose";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export interface IPostTarget {
  accountId: Types.ObjectId;
  platform: PlatformKey;
  status: "pending" | "published" | "failed";
  error?: string;
  /** The network says the account must be reconnected before it can post again. */
  needsReconnect?: boolean;
  externalId?: string;
  externalUrl?: string;
  publishedAt?: Date;
  attempts?: number;
}

/** Per-network settings chosen in Compose. */
export type PostOptions = {
  youtube?: { title?: string; privacy?: "public" | "unlisted" | "private" };
  pinterest?: { title?: string; link?: string; boardId?: string };
  /** Keyed by social account id: TikTok settings are per creator. */
  tiktok?: Record<
    string,
    {
      privacy?: string;
      comment?: boolean;
      duet?: boolean;
      stitch?: boolean;
      commercial?: boolean;
      yourBrand?: boolean;
      brandedContent?: boolean;
    }
  >;
};

export interface IPost {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  media: { mediaId: Types.ObjectId; url: string; resourceType: "image" | "video" }[];
  status: PostStatus;
  scheduledFor?: Date;
  publishedAt?: Date;
  publishStartedAt?: Date;
  targets: IPostTarget[];
  options?: PostOptions;
  createdAt: Date;
  updatedAt: Date;
}

const targetSchema = new Schema<IPostTarget>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "SocialAccount", required: true },
    platform: { type: String, enum: PLATFORM_KEYS, required: true },
    status: { type: String, enum: ["pending", "published", "failed"], default: "pending" },
    error: String,
    needsReconnect: Boolean,
    externalId: String,
    externalUrl: String,
    publishedAt: Date,
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const schema = new Schema<IPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, default: "" },
    media: [
      {
        _id: false,
        mediaId: { type: Schema.Types.ObjectId, ref: "Media" },
        url: String,
        resourceType: { type: String, enum: ["image", "video"] },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "scheduled", "publishing", "published", "failed"],
      default: "draft",
    },
    scheduledFor: Date,
    publishedAt: Date,
    publishStartedAt: Date,
    targets: [targetSchema],
    options: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
schema.index({ userId: 1, status: 1, updatedAt: -1 });
schema.index({ userId: 1, scheduledFor: 1 });
schema.index({ status: 1, scheduledFor: 1 });

export const Post = (models.Post as Model<IPost>) || model<IPost>("Post", schema);
