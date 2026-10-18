import { model, models, Schema, Types, type Model } from "mongoose";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms";

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export interface IPostTarget {
  accountId: Types.ObjectId;
  platform: PlatformKey;
  status: "pending" | "published" | "failed";
  error?: string;
  externalUrl?: string;
  publishedAt?: Date;
}

export interface IPost {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  media: { mediaId: Types.ObjectId; url: string; resourceType: "image" | "video" }[];
  status: PostStatus;
  scheduledFor?: Date;
  publishedAt?: Date;
  targets: IPostTarget[];
  createdAt: Date;
  updatedAt: Date;
}

const targetSchema = new Schema<IPostTarget>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "SocialAccount", required: true },
    platform: { type: String, enum: PLATFORM_KEYS, required: true },
    status: { type: String, enum: ["pending", "published", "failed"], default: "pending" },
    error: String,
    externalUrl: String,
    publishedAt: Date,
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
    targets: [targetSchema],
  },
  { timestamps: true },
);
schema.index({ userId: 1, status: 1, updatedAt: -1 });
schema.index({ userId: 1, scheduledFor: 1 });

export const Post = (models.Post as Model<IPost>) || model<IPost>("Post", schema);
