"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Full-screen overlay used by the landing and dashboard headers on small screens. */
export function MobileMenu({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  /** Visibility breakpoint, e.g. "md:hidden" or "lg:hidden". */
  className?: string;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background px-5 pb-8 pt-24",
            className ?? "md:hidden",
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
