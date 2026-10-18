import type { Metadata } from "next";
import { AccountsGrid, type Flash } from "@/components/dashboard/accounts-grid";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { platformStatuses } from "@/lib/publishing/registry";

export const metadata: Metadata = { title: "Accounts – Questreak" };
export const instant = false;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const accounts = await listAccounts(user.id);

  // Env var names are only useful to the person running the server, so hide them in production.
  const statuses = platformStatuses();
  if (process.env.NODE_ENV === "production") {
    for (const s of Object.values(statuses)) s.missing = [];
  }

  const flash: Flash = {
    connected: sp.connected,
    count: sp.count,
    error: sp.error,
    platform: sp.platform,
    detail: sp.detail,
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Connect the networks you post to. Everything you publish is sent to the accounts you pick."
      />
      <AccountsGrid accounts={accounts} statuses={statuses} flash={flash} />
    </>
  );
}
