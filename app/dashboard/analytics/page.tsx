import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import { BarChart } from "@/components/dashboard/bar-chart";
import { Heatmap } from "@/components/dashboard/heatmap";
import { PageHeader, PlatformIcon, StatCard } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  Link01Icon,
  SentIcon,
  File02Icon,
} from "@hugeicons/core-free-icons";

export const metadata: Metadata = { title: "Analytics – Questreak" };
export const instant = false;

const ranges = [7, 30, 90] as const;
const statusLabel: Record<string, string> = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Drafts",
  failed: "Failed",
  publishing: "Publishing",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = ranges.find((r) => String(r) === range) ?? 30;
  const user = await getCurrentUser();
  const data = await getAnalytics(user.id, days);

  const maxPlatform = Math.max(1, ...data.byPlatform.map((p) => p.count));
  const totalStatus = data.byStatus.reduce((a, b) => a + b.count, 0);
  const hasActivity = data.totals.posts > 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How much you're posting, where, and when."
        actions={
          <div className="flex rounded-full border border-border p-1 text-sm">
            {ranges.map((r) => (
              <Link
                key={r}
                href={`/dashboard/analytics?range=${r}`}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-colors",
                  r === days ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {r}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Posts created" value={data.totals.posts} icon={File02Icon} hint={`Last ${days} days`} />
        <StatCard label="Deliveries" value={data.totals.deliveries} icon={SentIcon} hint="Post × network" />
        <StatCard
          label="Delivery success"
          value={data.totals.successRate === null ? "—" : `${data.totals.successRate}%`}
          icon={AlertCircleIcon}
          hint={data.totals.successRate === null ? "No deliveries yet" : "Of all deliveries"}
        />
        <StatCard label="Connected accounts" value={data.accounts} icon={Link01Icon} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {["Reach", "Engagement", "Link clicks"].map((label) => (
          <div key={label} className="card flex items-center gap-4 p-5">
            <span className="grid size-10 place-items-center rounded-lg border border-border bg-white/5 text-muted">
              <HugeiconsIcon icon={LockIcon} size={18} />
            </span>
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted">
                {data.accounts > 0
                  ? "Collected once publishing is live"
                  : "Available once you connect an account"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-5 font-semibold">Posts published per day</h2>
        <BarChart data={data.days} label={`Last ${days} days`} height={180} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-5 font-semibold">By network</h2>
          {data.byPlatform.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No posts targeted a network in this period.</p>
          ) : (
            <ul className="space-y-4">
              {data.byPlatform.map((p) => {
                const meta = PLATFORMS[p.platform as PlatformKey];
                return (
                  <li key={p.platform} className="flex items-center gap-3">
                    <PlatformIcon platform={meta.key} size={16} />
                    <span className="w-20 shrink-0 text-sm">{meta.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-white/80" style={{ width: `${(p.count / maxPlatform) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-sm tabular-nums text-muted">{p.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-5 font-semibold">By status</h2>
          {totalStatus === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No posts in this period.</p>
          ) : (
            <ul className="space-y-4">
              {data.byStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm">{statusLabel[s.status] ?? s.status}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-white/80" style={{ width: `${(s.count / totalStatus) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums text-muted">
                    {s.count} · {Math.round((s.count / totalStatus) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-semibold">When you publish</h2>
          <span className="text-xs text-muted">Your local time</span>
        </div>
        {hasActivity ? (
          <Heatmap grid={data.heat} />
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Publish a few posts and your most active days and hours will show up here.
          </p>
        )}
      </section>
    </>
  );
}
