"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Rocket01Icon,
  ShoppingCart01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { PlatformIcon } from "@/components/ui/primitives";
import type { PlatformKey } from "@/lib/platforms";

const boostNetworks: PlatformKey[] = ["tiktok", "instagram", "facebook", "youtube"];

const offers = [
  {
    id: "boost",
    icon: Rocket01Icon,
    title: "Boost services",
    text: "Add followers, likes, views and subscribers to the accounts you already run.",
    points: [
      "Pick a platform, a service and a quality level",
      "Average and high quality options for most services",
      "Clear prices in naira, with the total shown before you order",
      "Track every order from your dashboard",
    ],
    cta: "Browse boost services",
    showNetworks: true,
  },
  {
    id: "accounts",
    icon: ShoppingCart01Icon,
    title: "Buy accounts",
    text: "Ready-made social media accounts, listed with live stock and a fixed price.",
    points: [
      "Search by category and account type",
      "See what's in stock before you buy",
      "Login details delivered to your orders page after payment",
      "Buy one account or several in a single order",
    ],
    cta: "Browse accounts",
    showNetworks: false,
  },
];

export function Growth() {
  return (
    <section id="growth" className="scroll-mt-20 border-y border-border bg-surface/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            More than posting
          </h2>
          <p className="mt-4 text-muted">
            Once your content is going out everywhere, grow the audience that sees it.
            Two optional services, built into the same dashboard.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {offers.map((o, i) => (
            <motion.article
              key={o.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1 }}
              className="card flex flex-col p-7"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-lg border border-border bg-white/5">
                  <HugeiconsIcon icon={o.icon} size={22} color="white" />
                </span>
                {o.showNetworks && (
                  <div className="flex -space-x-1.5">
                    {boostNetworks.map((p) => (
                      <PlatformIcon
                        key={p}
                        platform={p}
                        size={16}
                        className="rounded-full ring-2 ring-[var(--surface)]"
                      />
                    ))}
                  </div>
                )}
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{o.title}</h3>
              <p className="mt-2 leading-7 text-muted">{o.text}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {o.points.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      color="#34d399"
                      className="mt-0.5 shrink-0"
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex items-center gap-2 self-start text-sm font-medium underline-offset-4 hover:underline"
              >
                {o.cta}
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </Link>
            </motion.article>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted">
          Growth services are optional and separate from publishing. Please use them in line
          with each platform&apos;s rules.
        </p>
      </div>
    </section>
  );
}
