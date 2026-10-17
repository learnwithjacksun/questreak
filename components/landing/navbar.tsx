"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon } from "@hugeicons/core-free-icons";

const links = [
  { href: "#platforms", label: "Platforms" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Logo() {
  return (
    <a
      href="#"
      className="flex items-center gap-2 font-semibold tracking-tight"
    >
      <span className="bg-brand-gradient grid size-8 place-items-center rounded-lg">
        <HugeiconsIcon icon={SentIcon} size={18} color="white" />
      </span>
      <span className="text-lg">Questreak</span>
    </a>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-colors",
          open
            ? "border-transparent bg-background"
            : "border-border bg-background/70 backdrop-blur-xl",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="transition-colors hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#"
              className="px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              Log in
            </a>
            <a
              href="#"
              className="bg-brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get started
            </a>
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="relative z-[60] grid size-10 place-items-center md:hidden"
          >
            <span className="relative block h-3.5 w-6">
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-full rounded bg-foreground transition-all duration-300",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 h-0.5 w-full rounded bg-foreground transition-all duration-300",
                  open && "scale-x-0 opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 h-0.5 w-full rounded bg-foreground transition-all duration-300",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </nav>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex flex-col bg-background px-5 pb-8 pt-24 md:hidden"
          >
            <ul className="flex flex-1 flex-col justify-center gap-2">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-3xl font-semibold tracking-tight"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <a
                href="#"
                className="rounded-full border border-border px-4 py-3 text-center font-medium"
              >
                Log in
              </a>
              <a
                href="#"
                className="bg-brand-gradient rounded-full px-4 py-3 text-center font-medium text-white"
              >
                Get started
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
