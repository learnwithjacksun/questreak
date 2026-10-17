"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  ChartLineData01Icon,
  Image01Icon,
  AiMagicIcon,
  MagicWand01Icon,
  SentIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

const features = [
  {
    icon: SentIcon,
    title: "One composer",
    text: "Write your post once and send it to every connected account together.",
  },
  {
    icon: MagicWand01Icon,
    title: "Auto-adapted per platform",
    text: "Character limits, hashtags and formats are adjusted for each network automatically.",
  },
  {
    icon: Calendar03Icon,
    title: "Scheduling",
    text: "Queue posts for the perfect moment and let Questreak publish them for you.",
  },
  {
    icon: Image01Icon,
    title: "Media made easy",
    text: "Upload images and video once; we resize and deliver them where each platform needs them.",
  },
  {
    icon: Tick02Icon,
    title: "Live status tracking",
    text: "See which accounts succeeded, which failed, and retry with a click.",
  },
  {
    icon: ChartLineData01Icon,
    title: "Analytics",
    text: "Compare performance across networks to learn what your audience loves.",
  },
];

const aiActions = [
  "Generate post text from a short idea",
  "Rephrase in a different tone",
  "Remodel for a specific platform",
  "Fix grammar and spelling",
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything you need to stay consistent
        </h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.08 }}
              className="card p-6 transition-colors hover:border-white/20"
            >
              <span className="grid size-11 place-items-center rounded-lg border border-border bg-white/5">
                <HugeiconsIcon icon={f.icon} size={22} color="white" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 leading-7 text-muted">{f.text}</p>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className="card p-6 sm:col-span-2 lg:col-span-3 lg:flex lg:items-center lg:gap-10"
          >
            <div className="lg:flex-1">
              <span className="grid size-11 place-items-center rounded-lg border border-border bg-white/5">
                <HugeiconsIcon icon={AiMagicIcon} size={22} color="white" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">
                An AI writing assistant, only when you ask
              </h3>
              <p className="mt-2 leading-7 text-muted">
                Stuck on a caption? Ask for help right inside the composer. It
                never writes or changes anything unless you request it.
              </p>
            </div>
            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:mt-0 lg:flex-1">
              {aiActions.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2.5"
                >
                  <HugeiconsIcon icon={Tick02Icon} size={16} color="#34d399" />
                  {a}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
