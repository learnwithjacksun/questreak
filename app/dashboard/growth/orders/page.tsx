import type { Metadata } from "next";
import { OrdersView } from "@/components/dashboard/growth/orders-view";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listOrders } from "@/lib/data/orders";
import { paymentsEnabled } from "@/lib/payments";

export const metadata: Metadata = { title: "My orders – Questreak" };
export const instant = false;

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const orders = await listOrders(user.id);

  return (
    <>
      <PageHeader title="My orders" description="Track your boost orders and account purchases." />
      <OrdersView orders={orders} paymentsLive={paymentsEnabled()} />
    </>
  );
}
