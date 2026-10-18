"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo-mark";
import { MenuButton } from "@/components/ui/menu-button";
import { MobileMenu } from "@/components/ui/mobile-menu";

const links = [
  { href: "#platforms", label: "Platforms" },
  { href: "#features", label: "Features" },
  { href: "#growth", label: "Growth" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Logo({ href = "#" }: { href?: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 font-semibold tracking-tight"
    >
      <LogoMark size={24} />
      <span className="text-lg">Questreak</span>
    </a>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

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
              href="/login"
              className="px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="bg-brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get started
            </a>
          </div>
          <MenuButton
            open={open}
            onClick={() => setOpen((o) => !o)}
            className="md:hidden"
          />
        </nav>
      </header>
      <MobileMenu open={open}>
        <ul className="flex flex-1 flex-col gap-2">
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
            href="/login"
            className="rounded-full border border-border px-4 py-3 text-center font-medium"
          >
            Log in
          </a>
          <a
            href="/signup"
            className="bg-brand-gradient rounded-full px-4 py-3 text-center font-medium text-white"
          >
            Get started
          </a>
        </div>
      </MobileMenu>
    </>
  );
}
