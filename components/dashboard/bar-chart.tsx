"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Point = { date: string; count: number };

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Accessible bar chart with hover/focus readout. Pure SVG-free flex layout. */
export function BarChart({
  data,
  label,
  height = 160,
}: {
  data: Point[];
  label: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, b) => a + b.count, 0);
  const shown = active !== null ? data[active] : null;

  return (
    <figure>
      <figcaption className="mb-4 flex items-baseline justify-between text-sm">
        <span className="text-muted">
          {shown ? `${fmt(shown.date)}` : label}
        </span>
        <span className="font-medium tabular-nums">
          {shown ? `${shown.count} post${shown.count === 1 ? "" : "s"}` : `${total} total`}
        </span>
      </figcaption>
      <div
        role="img"
        aria-label={`${label}: ${total} total`}
        className="flex items-end gap-[3px]"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => (
          <button
            key={d.date}
            type="button"
            tabIndex={-1}
            aria-label={`${fmt(d.date)}: ${d.count}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={cn(
                "w-full rounded-t-[3px] transition-colors",
                d.count === 0 ? "bg-white/[0.06]" : "bg-white/70 group-hover:bg-white",
                active === i && d.count > 0 && "bg-white",
              )}
              style={{ height: d.count === 0 ? 3 : `${Math.max(6, (d.count / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{fmt(data[0].date)}</span>
        <span>{fmt(data[data.length - 1].date)}</span>
      </div>
    </figure>
  );
}
