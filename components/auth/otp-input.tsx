"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 5;

export function OtpInput({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  function focus(i: number) {
    refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();
  }

  function setDigit(i: number, d: string) {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(""));
  }

  function handleChange(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    // Autofill / multi-character input: spread across the boxes.
    if (clean.length > 1) {
      const next = digits.slice();
      clean
        .slice(0, LENGTH - i)
        .split("")
        .forEach((d, k) => (next[i + k] = d));
      onChange(next.join(""));
      focus(i + clean.length);
      return;
    }
    setDigit(i, clean);
    if (i < LENGTH - 1) focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) setDigit(i, "");
      else if (i > 0) {
        setDigit(i - 1, "");
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted.slice(0, LENGTH));
    focus(Math.min(pasted.length, LENGTH - 1));
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          pattern="\d*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-surface text-center text-2xl font-semibold outline-none transition-colors focus:border-white/50",
            error ? "border-red-400/70" : "border-border",
          )}
        />
      ))}
    </div>
  );
}
