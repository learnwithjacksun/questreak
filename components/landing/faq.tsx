"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Do you store my social media passwords?",
    a: "Never. Questreak connects through each platform's official OAuth flow, so we only hold revocable access tokens, stored encrypted.",
  },
  {
    q: "Which platforms are supported?",
    a: "Facebook Pages, X, Instagram (Business/Creator) and LinkedIn are first in line. Threads, TikTok, YouTube and Pinterest are coming soon.",
  },
  {
    q: "Can I post to my personal Facebook profile?",
    a: "Facebook only allows third-party apps to publish to Pages, not personal profiles, so Questreak supports Pages.",
  },
  {
    q: "Can I schedule posts?",
    a: "Yes. Pick a date and time and Questreak publishes automatically, retrying if a platform has a hiccup.",
  },
  {
    q: "Does AI write my posts for me?",
    a: "Only if you ask. The AI assistant can generate post text, rephrase, remodel or fix grammar on request. Nothing is changed or posted without your say-so.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — connect up to 3 accounts and start posting for free.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 border-t border-border py-24">
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium"
                >
                  {f.q}
                  <HugeiconsIcon
                    icon={Add01Icon}
                    size={20}
                    className={cn("shrink-0 transition-transform", isOpen && "rotate-45")}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="px-5 pb-5 leading-7 text-muted">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
