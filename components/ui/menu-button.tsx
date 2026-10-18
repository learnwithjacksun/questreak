"use client";

import { cn } from "@/lib/utils";

/** Three-bar hamburger that morphs into an X. */
export function MenuButton({
  open,
  onClick,
  className,
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={onClick}
      className={cn("relative z-[60] grid size-10 place-items-center", className)}
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
  );
}
