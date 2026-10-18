import "server-only";
import { encrypt } from "@/lib/crypto";
import { connectDB } from "@/lib/db";
import { addSmmOrder } from "@/lib/providers/smm";
import { purchaseAccounts } from "@/lib/providers/ypg";
import { Order } from "@/models/order";

/**
 * Marks an order paid (called by the payment webhook once a provider exists).
 * Idempotent: only an order still awaiting payment transitions.
 */
export async function markOrderPaid(orderId: string, provider: string, reference: string) {
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment" },
    {
      status: "paid",
      "payment.status": "paid",
      "payment.provider": provider,
      "payment.reference": reference,
      "payment.paidAt": new Date(),
    },
    { new: true },
  );
  return order;
}

/**
 * Talks to the supplier. NEVER called from a user-facing action: only after payment is
 * confirmed. The atomic `paid -> fulfilling` claim guarantees a single supplier call, and a
 * supplier failure is recorded (not retried) because YoungPG purchases are not retry-safe.
 */
export async function fulfillOrder(orderId: string) {
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "paid" },
    { status: "fulfilling" },
    { new: true },
  );
  if (!order) return { ok: false as const, reason: "Order is not awaiting fulfilment" };

  try {
    if (order.kind === "smm") {
      const supplierId = await addSmmOrder({
        serviceId: order.details.serviceId!,
        link: order.details.link!,
        quantity: order.quantity,
      });
      order.supplier = { orderId: supplierId, status: "Pending" };
      order.status = "delivered";
    } else {
      const res = await purchaseAccounts({
        slug: order.details.slug!,
        quantity: order.quantity,
      });
      order.supplier = { orderId: res.order_id, status: "Completed" };
      order.deliveredEnc = res.accounts.map(encrypt);
      order.status = "delivered";
    }
  } catch (err) {
    order.status = "failed";
    order.error = err instanceof Error ? err.message : "Supplier error";
  }
  await order.save();
  return { ok: order.status === "delivered" } as const;
}
