"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, SentIcon, Edit02Icon } from "@hugeicons/core-free-icons";

const steps = [
  {
    icon: Link01Icon,
    title: "Connect",
    text: "Securely link your Facebook, X, Instagram and other accounts with official OAuth.",
  },
  {
    icon: Edit02Icon,
    title: "Compose",
    text: "Write your post, add media, and pick the accounts you want to reach.",
  },
  {
    icon: SentIcon,
    title: "Publish",
    text: "Post now or schedule it. Questreak delivers it everywhere and reports back.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps to everywhere
        </h2>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="text-center"
            >
              <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-background">
                <HugeiconsIcon icon={s.icon} size={28} />
                <span className="bg-brand-gradient absolute -right-2 -top-2 grid size-6 place-items-center rounded-full text-xs font-semibold text-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs leading-7 text-muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
