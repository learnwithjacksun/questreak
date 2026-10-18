"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { connectDB } from "@/lib/db";
import { getPaymentProvider, paymentsEnabled } from "@/lib/payments";
import { fetchListing } from "@/lib/providers/ypg";
import { fetchSmmServices } from "@/lib/providers/smm";
import { round2, smmTotal } from "@/lib/pricing";
import {
  accountPurchaseSchema,
  boostOrderSchema,
  type AccountPurchaseInput,
  type BoostOrderInput,
} from "@/lib/validators/dashboard";
import { Order } from "@/models/order";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Creates an order awaiting payment and, when a payment provider exists, a checkout session.
 * Supplier APIs are NEVER called here: that only happens in `fulfillOrder` after payment.
 */
async function startCheckout(order: InstanceType<typeof Order>, email: string) {
  if (!paymentsEnabled()) return { checkoutUrl: null as string | null };
  const provider = getPaymentProvider();
  const session = await provider.createCheckout({
    orderId: String(order._id),
    amountNgn: order.totalNgn,
    email,
    description: order.title,
    returnUrl: `${process.env.APP_URL}/dashboard/growth/orders`,
  });
  order.payment = { provider: session.provider, reference: session.reference, status: "pending" };
  await order.save();
  return { checkoutUrl: session.url };
}

export async function placeBoostOrder(
  input: BoostOrderInput,
): Promise<Result<{ id: string; checkoutUrl: string | null }>> {
  const user = await getCurrentUser();
  const parsed = boostOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { serviceId, link, quantity } = parsed.data;

  let service;
  try {
    service = (await fetchSmmServices()).find((s) => s.id === serviceId);
  } catch {
    return { ok: false, error: "Boost services are unavailable right now. Try again shortly." };
  }
  if (!service) return { ok: false, error: "That service is no longer available." };
  if (quantity < service.min || quantity > service.max) {
    return { ok: false, error: `Quantity must be between ${service.min} and ${service.max}.` };
  }

  await connectDB();
  const order = await Order.create({
    userId: user.id,
    kind: "smm",
    provider: "smmpapa",
    title: service.name,
    quantity,
    unitPriceNgn: service.ratePer1000Ngn,
    costNgn: smmTotal(service.costPer1000Ngn, quantity),
    markupPercent: config.markupPercent,
    totalNgn: smmTotal(service.ratePer1000Ngn, quantity),
    details: { serviceId, link, category: service.category },
  });

  try {
    const { checkoutUrl } = await startCheckout(order, user.email);
    revalidatePath("/dashboard/growth/orders");
    return { ok: true, id: String(order._id), checkoutUrl };
  } catch {
    revalidatePath("/dashboard/growth/orders");
    return { ok: true, id: String(order._id), checkoutUrl: null };
  }
}

export async function placeAccountOrder(
  input: AccountPurchaseInput,
): Promise<Result<{ id: string; checkoutUrl: string | null }>> {
  const user = await getCurrentUser();
  const parsed = accountPurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { slug, quantity } = parsed.data;

  let listing;
  try {
    listing = await fetchListing(slug);
  } catch {
    return { ok: false, error: "That listing is unavailable right now." };
  }
  if (listing.stock < quantity) {
    return { ok: false, error: `Only ${listing.stock} in stock.` };
  }

  await connectDB();
  const order = await Order.create({
    userId: user.id,
    kind: "account",
    provider: "ypg",
    title: listing.title,
    quantity,
    unitPriceNgn: listing.priceNgn,
    costNgn: round2(listing.costNgn * quantity),
    markupPercent: config.markupPercent,
    totalNgn: round2(listing.priceNgn * quantity),
    details: { slug, category: listing.category },
  });

  try {
    const { checkoutUrl } = await startCheckout(order, user.email);
    revalidatePath("/dashboard/growth/orders");
    return { ok: true, id: String(order._id), checkoutUrl };
  } catch {
    revalidatePath("/dashboard/growth/orders");
    return { ok: true, id: String(order._id), checkoutUrl: null };
  }
}

export async function cancelOrder(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid order." };
  await connectDB();
  const res = await Order.updateOne(
    { _id: id, userId: user.id, status: "pending_payment" },
    { status: "cancelled" },
  );
  if (!res.modifiedCount) return { ok: false, error: "Only unpaid orders can be cancelled." };
  revalidatePath("/dashboard/growth/orders");
  return { ok: true };
}

/** Decrypts delivered credentials for the owner of a delivered order only. */
export async function revealCredentials(id: string): Promise<Result<{ accounts: string[] }>> {
  const user = await getCurrentUser();
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid order." };
  await connectDB();
  const order = await Order.findOne({
    _id: id,
    userId: user.id,
    kind: "account",
    status: "delivered",
  }).lean();
  if (!order) return { ok: false, error: "No delivered accounts for this order." };
  return { ok: true, accounts: order.deliveredEnc.map(decrypt) };
}
