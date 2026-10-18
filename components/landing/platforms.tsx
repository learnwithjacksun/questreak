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
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {platforms.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="card group flex flex-col items-center gap-3 p-6"
            >
              <span className="grayscale transition duration-300 group-hover:grayscale-0 group-active:grayscale-0">
                <PlatformIcon platform={p.key} size={40} />
              </span>
         
              <span className="font-medium">{p.name}</span>
              {!p.live && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">
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
