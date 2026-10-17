import { model, models, Schema, type Model } from "mongoose";

export type OtpPurpose = "verify" | "reset";

export interface IOtp {
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
}

const otpSchema = new Schema<IOtp>({
  email: { type: String, required: true, lowercase: true },
  purpose: { type: String, enum: ["verify", "reset"], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
  lastSentAt: { type: Date, required: true },
});

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

export const Otp = (models.Otp as Model<IOtp>) || model<IOtp>("Otp", otpSchema);
