import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreditCardIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PLANS, type PlanKey } from "@/lib/plans";
import { paymentsEnabled } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { Post } from "@/models/post";
import { SocialAccount } from "@/models/social-account";

export const metadata: Metadata = { title: "Billing – Questreak" };
export const instant = false;

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {used} / {limit ?? "Unlimited"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-white/80")}
          style={{ width: limit ? `${Math.max(pct, used > 0 ? 3 : 0)}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const user = await getCurrentUser();
  await connectDB();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [accounts, scheduled] = await Promise.all([
    SocialAccount.countDocuments({ userId: user.id }),
    Post.countDocuments({ userId: user.id, status: "scheduled", createdAt: { $gte: monthStart } }),
  ]);

  const plan = PLANS[user.plan];
  const live = paymentsEnabled();

  return (
    <>
      <PageHeader title="Billing" description="Your plan, usage and invoices." />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">Current plan</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{plan.name}</p>
              <p className="mt-1 text-sm text-muted">{plan.price === 0 ? "Free forever" : `$${plan.price} / month`}</p>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          <div className="mt-6 space-y-5">
            <Meter label="Connected accounts" used={accounts} limit={plan.accounts} />
            <Meter label="Scheduled posts this month" used={scheduled} limit={plan.scheduled} />
          </div>
        </section>

        <section className="card p-6">
          <p className="font-semibold">Payment method</p>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
            <HugeiconsIcon icon={CreditCardIcon} size={20} className="text-muted" />
            <p className="text-sm text-muted">
              {live ? "No payment method on file." : "Payments will be available soon."}
            </p>
          </div>
          <Button className="mt-4 w-full" variant="outline" disabled title={live ? undefined : "Payments aren't available yet"}>
            Add payment method
          </Button>
        </section>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold tracking-tight">Plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => {
          const p = PLANS[key];
          const current = key === user.plan;
          return (
            <div key={key} className={cn("card flex flex-col p-6", current && "border-white/30")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {current && <Badge>Current</Badge>}
              </div>
              <p className="mt-3">
                <span className="text-3xl font-semibold">${p.price}</span>
                <span className="text-sm text-muted"> /month</span>
              </p>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={Tick02Icon} size={15} className="text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={current ? "outline" : "primary"}
                disabled={current || !live}
                title={!live && !current ? "Upgrades aren't available yet" : undefined}
              >
                {current ? "Your plan" : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold tracking-tight">Invoices</h2>
      <div className="card">
        <p className="px-6 py-10 text-center text-sm text-muted">No invoices yet. They&apos;ll appear here once you subscribe.</p>
      </div>
    </>
  );
}
