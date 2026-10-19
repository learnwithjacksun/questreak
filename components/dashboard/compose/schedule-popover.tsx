"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { toLocalInputValue } from "@/lib/format";

function quickPicks() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() + (((8 - now.getDay()) % 7) || 7));
  monday.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", value: toLocalInputValue(inHour) },
    { label: "Tomorrow 9:00", value: toLocalInputValue(tomorrow) },
    { label: "Next Monday 9:00", value: toLocalInputValue(monday) },
  ];
}

/** The date/time picker only appears once the user chooses to schedule. */
export function SchedulePopover({
  value,
  onChange,
  onConfirm,
  disabled,
  blockReason,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  /** Whole control disabled (nothing valid to schedule yet). */
  disabled: boolean;
  blockReason: string | null;
  loading: boolean;
}) {
  const label = value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <Popover
      align="right"
      panelClassName="w-[min(20rem,calc(100vw-2.5rem))] p-4"
      trigger={(props) => (
        <Button
          {...props}
          variant="outline"
          className="h-9! px-3! sm:h-11! sm:px-5!"
          aria-label="Schedule"
          disabled={disabled}
          loading={loading}
          title={disabled ? (blockReason ?? undefined) : undefined}
          icon={<HugeiconsIcon icon={Calendar03Icon} size={16} />}
        >
          <span className="hidden sm:inline">Schedule</span>
          {label && (
            <span suppressHydrationWarning className="hidden text-muted sm:inline">
              · {label}
            </span>
          )}
        </Button>
      )}
    >
      {(close) => (
        <div role="group" aria-label="Schedule post">
          <label htmlFor="schedule" className="text-sm font-medium">
            When should it go out?
          </label>
          <input
            id="schedule"
            type="datetime-local"
            value={value}
            min={toLocalInputValue(new Date())}
            onChange={(e) => onChange(e.target.value)}
            className="mt-3 h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-base outline-none focus:border-white/40 [color-scheme:dark]"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quickPicks().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Times use your device&apos;s time zone.</p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              disabled={!value}
              onClick={() => {
                close();
                onConfirm();
              }}
            >
              Confirm schedule
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange("")}>
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
