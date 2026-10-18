import "server-only";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/order";
import { toOrderDTO } from "./serializers";

export async function listOrders(userId: string) {
  await connectDB();
  const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(200).lean();
  return orders.map(toOrderDTO);
}

export async function activeBoostCount(userId: string) {
  await connectDB();
  return Order.countDocuments({
    userId,
    kind: "smm",
    status: { $in: ["pending_payment", "paid", "fulfilling"] },
  });
}
