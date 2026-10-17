import { model, models, Schema, type Model } from "mongoose";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  emailVerified: boolean;
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
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);
