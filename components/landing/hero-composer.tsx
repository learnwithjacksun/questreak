"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  Image01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { platforms } from "./platform-icons";
import { PlatformIcon } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const targets = platforms.slice(0, 4);

const SEED =
  "Big news: we just shipped Questpay v2. Faster, simpler, and built for creators who show up everywhere.";

const REPHRASES = [
  "Questpay v2 is live! It's faster, simpler, and made for creators who show up everywhere.",
  "We're excited to launch Questpay v2: quicker, easier, and built for creators on every platform.",
  "Say hello to Questpay v2. Speed, simplicity, and a home for creators who are everywhere.",
];

type AiAction = "grammar" | "rephrase" | "shorten" | "hashtags";

const AI_ACTIONS: { id: AiAction; label: string }[] = [
  { id: "grammar", label: "Fix grammar" },
  { id: "rephrase", label: "Rephrase" },
  { id: "shorten", label: "Shorten" },
  { id: "hashtags", label: "Add hashtags" },
];

const TYPOS: [RegExp, string][] = [
  [/\bteh\b/gi, "the"],
  [/\brecieve\b/gi, "receive"],
  [/\bdefinately\b/gi, "definitely"],
  [/\bwich\b/gi, "which"],
  [/\bi\b/g, "I"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
];

function fixGrammar(text: string) {
  let t = text.replace(/[ \t]+/g, " ").trim();
  for (const [re, to] of TYPOS) t = t.replace(re, to);
  t = t.replace(/\s+([,.!?])/g, "$1");
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  if (t && !/[.!?#]$/.test(t)) t += ".";
  return t;
}

function shorten(text: string) {
  const first = text.split(/(?<=[.!?:])\s+/)[0] ?? text;
  const base =
    first.length < text.length ? first : text.slice(0, Math.ceil(text.length * 0.6));
  return fixGrammar(base.replace(/[:,;]\s*$/, ""));
}

function addHashtags(text: string) {
  return /#\w+/.test(text)
    ? text
    : `${text.trim()}\n\n#launch #creators #buildinpublic`;
}

export function HeroComposer() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(SEED);
  const [prev, setPrev] = useState<string | null>(null);
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [variant, setVariant] = useState(0);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(targets.map((t) => t.key)),
  );

  // Auto-grow the textarea with its content.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Free the object URL when the image changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  function runAi(action: AiAction) {
    if (busy) return;
    setBusy(action);
    window.setTimeout(() => {
      setPrev(text);
      if (action === "grammar") setText(fixGrammar(text));
      else if (action === "shorten") setText(shorten(text));
      else if (action === "hashtags") setText(addHashtags(text));
      else {
        // Rephrase: canned variants for the demo copy, a light polish otherwise.
        const demo = text.trim() === SEED || REPHRASES.includes(text);
        setText(demo ? REPHRASES[variant % REPHRASES.length] : `${fixGrammar(text)} Here's the latest.`);
        setVariant((v) => (v + 1) % REPHRASES.length);
      }
      setBusy(null);
    }, 800);
  }

  function pickImage(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setImage({ url: URL.createObjectURL(file), name: file.name });
  }

  function toggle(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  const count = selected.size;
  const goAuth = () => router.push("/login");

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="card relative p-5 shadow-2xl shadow-violet/10"
    >
      <p className="text-sm font-medium text-muted">New post</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {AI_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => runAi(a.id)}
            disabled={!!busy || !text.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50",
              busy === a.id && "animate-pulse border-violet/60",
            )}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={14} />
            {busy === a.id ? "Thinking…" : a.label}
          </button>
        ))}
        {prev !== null && !busy && (
          <button
            type="button"
            onClick={() => {
              setText(prev);
              setPrev(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={14} />
            Undo
          </button>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-background/60 p-4 text-[15px] leading-7 focus-within:border-white/25">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="What do you want to share?"
          aria-label="Post text"
          className={cn(
            "block w-full resize-none bg-transparent outline-none placeholder:text-muted",
            busy && "opacity-50",
          )}
        />

        {image && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-14 rounded-md object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted">
              {image.name}
            </span>
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => setImage(null)}
              className="grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          {image ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-muted transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={Image01Icon} size={18} />
              <span className="text-xs">Add an image</span>
            </button>
          )}
          <p className="text-[11px] tabular-nums text-muted">{text.length}/280</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {targets.map((p) => {
          const on = selected.has(p.key);
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.key)}
              className={cn(
                "flex items-center justify-between rounded-xl border bg-background/60 px-3 py-2.5 text-left transition-colors",
                on
                  ? "border-border hover:border-white/25"
                  : "border-border/60 opacity-60 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-2.5 text-sm">
                <PlatformIcon platform={p.key} size={16} />
                {p.name}
              </span>
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full transition-colors",
                  on ? "bg-emerald-500" : "border border-border",
                )}
              >
                {on && <HugeiconsIcon icon={Tick02Icon} size={12} color="white" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={goAuth}
          disabled={count === 0}
          className="bg-brand-gradient flex-1 rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Publish to {count} account{count === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          onClick={goAuth}
          className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-white/5"
        >
          Schedule
        </button>
      </div>
    </motion.div>
  );
}
