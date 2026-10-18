"use client";

import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

/** Renders a timestamp in the viewer's locale/timezone (server output may differ, hence suppress). */
export function LocalTime({
  iso,
  variant = "datetime",
  className,
}: {
  iso: string;
  variant?: "datetime" | "date" | "ago";
  className?: string;
}) {
  const text =
    variant === "ago" ? timeAgo(iso) : variant === "date" ? formatDate(iso) : formatDateTime(iso);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
