import type { Metadata } from "next";
import { BoostCatalog } from "@/components/dashboard/growth/boost-catalog";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Boost services – Questreak" };

export default function BoostPage() {
  return (
    <>
      <PageHeader
        title="Boost services"
        description="Grow followers, likes, views and more. Pick a service, paste your link, and order."
      />
      <BoostCatalog />
    </>
  );
}
