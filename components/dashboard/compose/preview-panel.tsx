"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";

const KEY = "compose-preview";
const listeners = new Set<() => void>();
let memory: "open" | "closed" | null = null;

function read(): "open" | "closed" | null {
  if (memory) return memory;
  try {
    const v = localStorage.getItem(KEY);
    return v === "open" || v === "closed" ? v : null;
  } catch {
    return null;
  }
}

function write(v: "open" | "closed") {
  memory = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Preview open/closed state. Defaults to open on wide screens and closed on small ones,
 * and remembers the user's choice.
 */
export function usePreviewPanel() {
  const pref = useSyncExternalStore(subscribe, read, () => null);
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
  const open = pref ? pref === "open" : desktop;
  return { open, desktop, toggle: () => write(open ? "closed" : "open"), close: () => write("closed") };
}

const WIDTH = 380;

/** Retractable preview: slides in beside the editor on desktop, becomes a drawer on smaller screens. */
export function PreviewPanel({
  open,
  desktop,
  onClose,
  children,
}: {
  open: boolean;
  desktop: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!desktop) {
    return (
      <Modal open={open} onClose={onClose} title="Preview" side>
        {children}
      </Modal>
    );
  }
  return (
    <motion.aside
      aria-label="Post preview"
      aria-hidden={!open}
      initial={false}
      animate={{ width: open ? WIDTH : 0, opacity: open ? 1 : 0, marginLeft: open ? 32 : 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="sticky top-36 hidden shrink-0 self-start overflow-hidden lg:block"
      inert={!open}
    >
      <div style={{ width: WIDTH }}>{children}</div>
    </motion.aside>
  );
}
