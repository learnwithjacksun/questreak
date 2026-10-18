import { model, models, Schema, type Model } from "mongoose";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  emailVerified: boolean;
  plan: "free" | "pro" | "team";
  role: "user" | "admin";
  notificationPrefs: {
    productUpdates: boolean;
    publishAlerts: boolean;
    orderUpdates: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: String,
    googleId: { type: String, index: true, sparse: true },
    avatar: String,
    emailVerified: { type: Boolean, default: false },
    plan: { type: String, enum: ["free", "pro", "team"], default: "free" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    notificationPrefs: {
      productUpdates: { type: Boolean, default: true },
      publishAlerts: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);
