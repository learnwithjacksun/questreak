"use client";

import { motion } from "framer-motion";
import { platforms } from "./platform-icons";
import { PlatformIcon } from "@/components/ui/primitives";

export function Platforms() {
  return (
    <section id="platforms" className="scroll-mt-20 border-y border-border py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-semibold tracking-tight">
          All your networks, one dashboard
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          Connected through each platform&apos;s official API — no password
          sharing, ever.
        </p>
        <div className="mt-12 grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-4">
          {platforms.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="card group flex min-w-0 flex-col items-center gap-2 p-3 text-center sm:gap-3 sm:p-6"
            >
              <span className="-m-2 scale-[0.7] grayscale transition sm:m-0 sm:scale-100 duration-300 group-hover:grayscale-0 group-active:grayscale-0">
                <PlatformIcon platform={p.key} size={40} />
              </span>
              <span className="text-xs font-medium sm:text-base">{p.name}</span>
              {!p.live && (
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-muted sm:px-2 sm:text-[11px]">
                  Coming soon
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
