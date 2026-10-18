"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Image01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { platforms } from "./platform-icons";
import { PlatformIcon } from "@/components/ui/primitives";

const targets = platforms.slice(0, 4);

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute hidden md:block left-1/2 top-[-10rem] h-[32rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-25 blur-[120px]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-20 lg:grid-cols-2 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="sm:text-5xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Write once.
            <br />
            <span className="text-muted">Post everywhere.</span>
          </h1>
          <p className="mt-6 max-w-lg md:text-lg text-base leading-8 text-muted">
            Questreak publishes your content to Facebook, X, Instagram, LinkedIn
            and more in one click, adapted to each platform, scheduled when you
            want, tracked all in one place.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="/signup"
              className="bg-brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              Start posting free
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 font-medium transition-colors hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="card relative p-5 shadow-2xl shadow-violet/10"
        >
          <p className="text-sm font-medium text-muted">New post</p>
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-4 text-[15px] leading-7">
            Big news: we just shipped Questpay v2. Faster, simpler, and built for
            creators who show up everywhere.
            <div className="mt-3 flex items-center gap-2 text-muted">
              <HugeiconsIcon icon={Image01Icon} size={18} />
              <span className="text-xs">launch-banner.png</span>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {targets.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.35 }}
                className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2.5"
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <PlatformIcon platform={p.key} size={16} />
                  {p.name}
                </span>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 1.1 + i * 0.35,
                    type: "spring",
                    stiffness: 400,
                  }}
                  className="grid size-5 place-items-center rounded-full bg-emerald-500"
                >
                  <HugeiconsIcon icon={Tick02Icon} size={12} color="white" />
                </motion.span>
              </motion.div>
            ))}
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="bg-brand-gradient mt-5 w-full rounded-xl py-3 text-sm font-medium text-white"
          >
            Publish to 4 accounts
          </button>
        </motion.div>
      </div>
    </section>
  );
}
