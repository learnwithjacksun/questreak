"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-muted">
      <p className="tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          className={btn}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="Next page"
          className={btn}
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
        </button>
      </div>
    </div>
  );
}
