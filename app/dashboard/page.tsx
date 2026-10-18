import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  File02Icon,
  Link01Icon,
  PencilEdit02Icon,
  Rocket01Icon,
  SentIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { BarChart } from "@/components/dashboard/bar-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getOverview } from "@/lib/data/overview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview – Questreak" };
export const instant = false;

const quickActions = [
  {
    href: "/dashboard/compose",
    title: "New post",
    text: "Write once, publish everywhere",
    icon: PencilEdit02Icon,
  },
  {
    href: "/dashboard/accounts",
    title: "Connect an account",
    text: "Link Facebook, X, Instagram…",
    icon: Link01Icon,
  },
  {
    href: "/dashboard/growth/boost",
    title: "Boost your reach",
    text: "Followers, likes and views",
    icon: Rocket01Icon,
  },
  {
    href: "/dashboard/growth/accounts",
    title: "Buy accounts",
    text: "Ready-made social accounts",
    icon: ShoppingCart01Icon,
  },
];

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const { stats, days, recent, totalPosts } = await getOverview(user.id);

  const checklist = [
    {
      done: stats.connectedAccounts > 0,
      label: "Connect a social account",
      href: "/dashboard/accounts",
    },
    {
      done: totalPosts > 0,
      label: "Create your first post",
      href: "/dashboard/compose",
    },
    {
      done: stats.scheduled + stats.published > 0,
      label: "Schedule or publish a post",
      href: "/dashboard/compose",
    },
  ];
  const remaining = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name} 👋`}
        description="Here's what's happening across your accounts."
        actions={
          <LinkButton
            href="/dashboard/compose"
            icon={<HugeiconsIcon icon={Add01Icon} size={18} />}
          >
            New post
          </LinkButton>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Connected networks"
          value={stats.connectedAccounts}
          icon={Link01Icon}
          hint={
            stats.connectedAccounts === 0
              ? "None connected yet"
              : "Active accounts"
          }
        />
        <StatCard
          label="Published posts"
          value={stats.published}
          icon={SentIcon}
          delta={{ value: stats.publishedDelta, label: "" }}
          hint="vs previous 30 days"
        />
        <StatCard
          label="Scheduled posts"
          value={stats.scheduled}
          icon={Calendar03Icon}
          hint="Waiting to go out"
        />
        <StatCard
          label="Drafts"
          value={stats.drafts}
          icon={File02Icon}
          hint="Not scheduled yet"
        />
        <StatCard
          label="Failed deliveries"
          value={stats.failed}
          icon={AlertCircleIcon}
          hint={stats.failed ? "Needs attention" : "All clear"}
        />
        <StatCard
          label="Open boost orders"
          value={stats.activeBoosts}
          icon={Rocket01Icon}
          hint="Awaiting payment or in progress"
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card group flex flex-col p-5 transition-colors hover:border-white/20"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg border border-border bg-white/5">
                  <HugeiconsIcon icon={a.icon} size={19} />
                </span>
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  size={18}
                  className="text-muted transition-colors group-hover:text-foreground"
                />
              </div>
              <p className="mt-4 font-medium">{a.title}</p>
              <p className="mt-0.5 text-sm text-muted">{a.text}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-5 font-semibold">Publishing activity</h2>
          <BarChart data={days} label="Last 30 days" />
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Get started</h2>
            <span className="text-xs text-muted">
              {3 - remaining} of 3 done
            </span>
          </div>
          <ul className="mt-4 space-y-1">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-white/5"
                >
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={20}
                    className={cn(
                      c.done ? "text-emerald-400" : "text-muted/50",
                    )}
                  />
                  <span className={cn(c.done && "text-muted line-through")}>
                    {c.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Recent activity
        </h2>
        <RecentActivity
          published={recent.published}
          scheduled={recent.scheduled}
          stats={{ published: stats.published, scheduled: stats.scheduled }}
        />
      </div>
    </>
  );
}
