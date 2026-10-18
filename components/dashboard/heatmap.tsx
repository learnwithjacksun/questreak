"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Posting-time heatmap. Server sends UTC buckets; we shift them into the viewer's time zone. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const { local, max } = useMemo(() => {
    const shift = Math.round(-new Date().getTimezoneOffset() / 60); // hours ahead of UTC
    const out = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    grid.forEach((row, d) =>
      row.forEach((n, h) => {
        if (!n) return;
        const t = (((d * 24 + h + shift) % 168) + 168) % 168;
        out[Math.floor(t / 24)][t % 24] += n;
      }),
    );
    return { local: out, max: Math.max(1, ...out.flat()) };
  }, [grid]);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = [0, 6, 12, 18];

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="ml-10 grid grid-cols-24 text-[10px] text-muted" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{hours.includes(h) ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}</span>
            ))}
          </div>
          {local.map((row, d) => (
            <div key={d} className="mt-1 flex items-center gap-2">
              <span className="w-8 text-[11px] text-muted">{days[d]}</span>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                {row.map((n, h) => (
                  <span
                    key={h}
                    title={`${days[d]} ${h}:00, ${n} post${n === 1 ? "" : "s"}`}
                    className={cn("aspect-square rounded-[3px]", n === 0 && "bg-white/[0.05]")}
                    style={n ? { backgroundColor: `rgba(244,244,248,${0.2 + (n / max) * 0.8})` } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
