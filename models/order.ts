import { model, models, Schema, Types, type Model } from "mongoose";

export type OrderKind = "smm" | "account";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilling"
  | "delivered"
  | "failed"
  | "cancelled";

export interface IOrder {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: OrderKind;
  status: OrderStatus;
  title: string;
  quantity: number;
  /** Final unit price in NGN (per 1,000 for SMM, per account for accounts). */
  unitPriceNgn: number;
  /** Supplier cost in NGN before markup. */
  costNgn: number;
  markupPercent: number;
  totalNgn: number;
  provider: "smmpapa" | "ypg";
  details: {
    serviceId?: number;
    link?: string;
    slug?: string;
    category?: string;
  };
  supplier: {
    orderId?: string;
    status?: string;
    startCount?: number;
    remains?: number;
  };
  payment: {
    provider?: string;
    reference?: string;
    status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
    paidAt?: Date;
  };
  /** Encrypted `email:password` strings for delivered accounts. */
  deliveredEnc: string[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["smm", "account"], required: true },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "fulfilling", "delivered", "failed", "cancelled"],
      default: "pending_payment",
    },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPriceNgn: { type: Number, required: true },
    costNgn: { type: Number, required: true },
    markupPercent: { type: Number, required: true },
    totalNgn: { type: Number, required: true },
    provider: { type: String, enum: ["smmpapa", "ypg"], required: true },
    details: {
      serviceId: Number,
      link: String,
      slug: String,
      category: String,
    },
    supplier: {
      orderId: String,
      status: String,
      startCount: Number,
      remains: Number,
    },
    payment: {
      provider: String,
      reference: String,
      status: {
        type: String,
        enum: ["unpaid", "pending", "paid", "failed", "refunded"],
        default: "unpaid",
      },
      paidAt: Date,
    },
    deliveredEnc: { type: [String], default: [] },
    error: String,
  },
  { timestamps: true },
);
schema.index({ userId: 1, createdAt: -1 });

export const Order = (models.Order as Model<IOrder>) || model<IOrder>("Order", schema);
