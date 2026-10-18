import type { Metadata } from "next";
import { AccountMarket } from "@/components/dashboard/growth/account-market";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Buy accounts – Questreak" };

export default function BuyAccountsPage() {
  return (
    <>
      <PageHeader
        title="Buy accounts"
        description="Ready-made social media accounts, delivered to your orders page after payment."
      />
      <AccountMarket />
    </>
  );
}
