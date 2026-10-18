import { Suspense, type ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Providers } from "@/components/dashboard/providers";
import { Logo } from "@/components/landing/navbar";
import { Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";

/** Cookie-backed session auth; allow navigations to block while the session resolves. */
export const instant = false;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </main>
    </Providers>
  );
}

async function Header() {
  const user = await getCurrentUser();
  return (
    <DashboardHeader
      user={{ name: user.name, email: user.email, avatar: user.avatar }}
    />
  );
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
        <Logo href="/dashboard" />
        <Skeleton className="ml-auto h-9 w-32 rounded-full" />
      </div>
    </header>
  );
}

function PageFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
