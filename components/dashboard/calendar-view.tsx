"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { Button, LinkButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import type { PostDTO } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { PostRow } from "./post-row";

type View = "month" | "week";

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const statusDot: Record<string, string> = {
  published: "bg-emerald-400",
  scheduled: "bg-sky-400",
  draft: "bg-white/40",
  failed: "bg-red-400",
  publishing: "bg-amber-400",
};

export function CalendarView({
  anchor,
  view,
  posts,
}: {
  anchor: string;
  view: View;
  posts: PostDTO[];
}) {
  const router = useRouter();
  const anchorDate = parse(anchor);
  const todayKey = key(new Date());
  const [selected, setSelected] = useState<string>(todayKey);

  const days = useMemo(() => {
    if (view === "week") {
      const start = addDays(anchorDate, -anchorDate.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const last = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    const total = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, view]);

  const byDay = useMemo(() => {
    const map = new Map<string, PostDTO[]>();
    for (const p of posts) {
      const when = p.scheduledFor ?? p.publishedAt;
      if (!when) continue;
      const k = key(new Date(when));
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
  }, [posts]);

  function go(date: Date, v: View = view) {
    router.push(`/dashboard/calendar?view=${v}&date=${key(date)}`);
  }
  function step(dir: 1 | -1) {
    go(
      view === "week"
        ? addDays(anchorDate, 7 * dir)
        : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1),
    );
  }

  const title =
    view === "month"
      ? anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const selectedPosts = byDay.get(selected) ?? [];
  const selectedDate = parse(selected);
  const canCompose = selected >= todayKey;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(2023, 0, 1), i).toLocaleDateString(undefined, { weekday: "short" }),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 w-full text-lg sm:w-auto sm:min-w-44 font-semibold tracking-tight" suppressHydrationWarning>
            {title}
          </h2>
          <Button size="sm" variant="outline" aria-label="Previous" onClick={() => step(-1)} className="!px-2.5">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => go(new Date())}>
            Today
          </Button>
          <Button size="sm" variant="outline" aria-label="Next" onClick={() => step(1)} className="!px-2.5">
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
        <Tabs<View>
          className="border-b-0"
          value={view}
          onChange={(v) => go(anchorDate, v)}
          items={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted">
          {weekdays.map((w) => (
            <div key={w} className="py-2.5" suppressHydrationWarning>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const k = key(d);
            const items = byDay.get(k) ?? [];
            const outside = view === "month" && d.getMonth() !== anchorDate.getMonth();
            const isSel = k === selected;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-label={`${d.toDateString()}, ${items.length} posts`}
                aria-pressed={isSel}
                className={cn(
                  "flex flex-col items-stretch gap-1 border-border p-1.5 text-left transition-colors hover:bg-white/[0.03] sm:p-2",
                  view === "week" ? "min-h-48" : "min-h-20 sm:min-h-28",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  outside && "opacity-40",
                  isSel && "bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center self-start rounded-full text-xs tabular-nums",
                    k === todayKey && "bg-foreground font-semibold text-background",
                  )}
                >
                  {d.getDate()}
                </span>
                {/* Chips on larger screens, dots on small */}
                <span className="hidden flex-col gap-1 sm:flex">
                  {items.slice(0, view === "week" ? 6 : 2).map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 truncate rounded-md bg-white/5 px-1.5 py-1 text-[11px]">
                      <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[p.status])} />
                      <span className="truncate">{p.text.trim() || "Media post"}</span>
                    </span>
                  ))}
                  {items.length > (view === "week" ? 6 : 2) && (
                    <span className="px-1.5 text-[11px] text-muted">+{items.length - (view === "week" ? 6 : 2)} more</span>
                  )}
                </span>
                {items.length > 0 && (
                  <span className="flex gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((p) => (
                      <span key={p.id} className={cn("size-1.5 rounded-full", statusDot[p.status])} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {["scheduled", "published", "draft", "failed"].map((s) => (
          <span key={s} className="flex items-center gap-2 capitalize">
            <span className={cn("size-2 rounded-full", statusDot[s])} />
            {s}
          </span>
        ))}
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="font-semibold" suppressHydrationWarning>
            {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {canCompose ? (
            <LinkButton
              size="sm"
              variant="outline"
              href={`/dashboard/compose?date=${selected}`}
              icon={<HugeiconsIcon icon={Add01Icon} size={16} />}
            >
              New post on this day
            </LinkButton>
          ) : null}
        </div>
        {selectedPosts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            Nothing {canCompose ? "planned" : "posted"} on this day.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {selectedPosts.map((p) => (
              <li key={p.id}>
                <PostRow
                  post={p}
                  actions={
                    p.status !== "published" ? (
                      <Link href={`/dashboard/compose?edit=${p.id}`} className="text-sm text-muted hover:text-foreground">
                        Edit
                      </Link>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
