import { Suspense } from "react";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon } from "@hugeicons/core-free-icons";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/landing/navbar";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard – Questreak" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted">Loading…</div>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <Logo href="/dashboard" />
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={Logout01Icon} size={16} />
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {user.name}
        </h1>
        <p className="mt-2 text-muted">
          You&apos;re signed in as {user.email}. Your dashboard is coming soon.
        </p>
      </main>
    </div>
  );
}
