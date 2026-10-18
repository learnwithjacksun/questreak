import { model, models, Schema, Types, type Model } from "mongoose";

export interface IMedia {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  publicId: string;
  url: string;
  resourceType: "image" | "video";
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  name: string;
  createdAt: Date;
}

const schema = new Schema<IMedia>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    format: String,
    bytes: { type: Number, default: 0 },
    width: Number,
    height: Number,
    duration: Number,
    name: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Media =
  (models.Media as Model<IMedia>) || model<IMedia>("Media", schema);
