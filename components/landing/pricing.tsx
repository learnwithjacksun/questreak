import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    price: "$0",
    desc: "For trying things out.",
    features: ["3 social accounts", "10 scheduled posts / month", "Basic post tracking"],
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    desc: "For creators and freelancers.",
    features: [
      "10 social accounts",
      "Unlimited scheduled posts",
      "Per-platform adaptation",
      "Analytics",
    ],
    featured: true,
  },
  {
    name: "Team",
    price: "$39",
    desc: "For brands and agencies.",
    features: ["Unlimited accounts", "Team members & roles", "Approval workflows", "Priority support"],
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple, honest pricing
        </h2>
        <p className="mt-3 text-center text-muted">Placeholder tiers — final pricing coming soon.</p>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "card flex flex-col p-7",
                t.featured && "border-pink/60 shadow-2xl shadow-pink/10",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t.name}</h3>
                {t.featured && (
                  <span className="bg-brand-gradient rounded-full px-2.5 py-0.5 text-xs font-medium text-white">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-4">
                <span className="text-4xl font-semibold">{t.price}</span>
                <span className="text-muted"> /month</span>
              </p>
              <p className="mt-2 text-sm text-muted">{t.desc}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={Tick02Icon} size={16} color="#34d399" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/signup"
                className={cn(
                  "mt-8 rounded-full px-5 py-3 text-center text-sm font-medium transition-opacity",
                  t.featured
                    ? "bg-brand-gradient text-white hover:opacity-90"
                    : "border border-border hover:bg-white/5",
                )}
              >
                Get started
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
