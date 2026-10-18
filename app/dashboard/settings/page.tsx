import type { Metadata } from "next";
import { SettingsView } from "@/components/dashboard/settings-view";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings – Questreak" };
export const instant = false;

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, security and notifications." />
      <SettingsView
        user={{
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          hasPassword: user.hasPassword,
          createdAt: user.createdAt.toISOString(),
          notificationPrefs: user.notificationPrefs,
        }}
      />
    </>
  );
}
