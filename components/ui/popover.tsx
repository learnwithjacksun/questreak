"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type TriggerProps = {
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
};

/**
 * Dropdown panel: click or hover to open, Esc / outside click to close,
 * arrow keys move between `[role=menuitem]` children.
 */
export function Popover({
  trigger,
  children,
  align = "left",
  openOnHover = false,
  className,
  panelClassName,
}: {
  trigger: (props: TriggerProps, open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  openOnHover?: boolean;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [],
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? items[(i + 1) % items.length]
        : items[(i - 1 + items.length) % items.length];
    next.focus();
  }

  function hover(state: boolean) {
    if (!openOnHover) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(state), state ? 60 : 140);
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
    >
      {trigger(
        {
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": id,
          onClick: () => setOpen((o) => !o),
        },
        open,
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            onKeyDown={onPanelKeyDown}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "absolute top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/40",
              align === "right" ? "right-0" : "left-0",
              panelClassName,
            )}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none";
