"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HeroComposer } from "./hero-composer";

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
            Compose once.
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

        <HeroComposer />
      </div>
    </section>
  );
}
