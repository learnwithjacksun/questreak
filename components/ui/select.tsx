"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  /** Secondary text shown under the label in the list. */
  description?: string;
  /** Small leading element, e.g. a platform logo. */
  icon?: ReactNode;
  disabled?: boolean;
};

/**
 * Custom dropdown used for every select in the app. Combobox/listbox semantics,
 * full keyboard support, optional search, chevron that flips while open.
 */
export function Select<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  ariaLabel,
  searchable = false,
  disabled = false,
  error,
  className,
  emptyText = "No results",
}: {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Visible label above the trigger. */
  label?: string;
  /** Required when there is no visible label. */
  ariaLabel?: string;
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  emptyText?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function openList() {
    if (disabled) return;
    const i = shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : firstEnabled(shown, 0, 1));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function choose(o: SelectOption<T> | undefined) {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function move(dir: 1 | -1) {
    setActive((cur) => firstEnabled(shown, cur + dir, dir));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(firstEnabled(shown, 0, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(firstEnabled(shown, shown.length - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        choose(shown[active]);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        // Type-ahead for non-searchable lists.
        if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const now = e.timeStamp;
          const t = typed.current;
          t.text = now - t.at > 700 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const i = shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
          if (i >= 0) setActive(i);
        }
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      {label && (
        <label id={`${id}-label`} className="mb-2 block text-sm font-medium">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={!!error}
        aria-activedescendant={open && !searchable ? `${id}-opt-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-xl border bg-surface px-3.5 text-left text-base outline-none transition-colors",
          "focus-visible:border-white/40 disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-white/40" : "border-border hover:border-white/20",
          error && "border-red-400/70",
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-2.5", !selected && "text-muted/70")}>
          {selected?.icon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={18}
          className={cn("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-[60] mt-1.5 min-w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50"
          >
            {searchable && (
              <div className="relative border-b border-border p-1.5">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Search…"
                  aria-label="Search options"
                  aria-controls={`${id}-list`}
                  aria-activedescendant={`${id}-opt-${active}`}
                  className="h-9 w-full rounded-lg bg-transparent pl-8 pr-2 text-base outline-none placeholder:text-muted/60"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={label ? `${id}-label` : undefined}
              className="max-h-64 overflow-y-auto p-1.5"
            >
              {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{emptyText}</li>}
              {shown.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li
                    key={String(o.value)}
                    id={`${id}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      i === active && "bg-white/[0.06]",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {o.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                    </span>
                    {isSel && <HugeiconsIcon icon={Tick02Icon} size={16} className="shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function firstEnabled<T extends string | number>(list: SelectOption<T>[], from: number, dir: 1 | -1) {
  if (list.length === 0) return 0;
  let i = Math.max(0, Math.min(list.length - 1, from));
  for (let n = 0; n < list.length; n++) {
    if (!list[i].disabled) return i;
    i = (i + dir + list.length) % list.length;
  }
  return 0;
}
