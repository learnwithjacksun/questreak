import type { Metadata } from "next";
import { AccountsGrid } from "@/components/dashboard/accounts-grid";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";

export const metadata: Metadata = { title: "Accounts – Questreak" };
export const instant = false;

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await listAccounts(user.id);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Connect the networks you post to. Everything you publish is sent to the accounts you pick."
      />
      <AccountsGrid accounts={accounts} />
    </>
  );
}
