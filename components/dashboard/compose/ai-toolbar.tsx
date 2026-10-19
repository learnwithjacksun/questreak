"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, Cancel01Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";
import { useComposeStore } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";

type Mode = "generate" | "rephrase" | "remodel" | "grammar";
const tones = ["friendly", "professional", "playful", "bold", "concise"] as const;
type Tone = (typeof tones)[number];

const ACTIONS: { mode: Mode; label: string; /** Runs straight away on the current text. */ instant: boolean }[] = [
  { mode: "generate", label: "Generate", instant: false },
  { mode: "rephrase", label: "Rephrase", instant: true },
  { mode: "remodel", label: "Remodel", instant: false },
  { mode: "grammar", label: "Fix grammar", instant: true },
];

const copy: Record<Mode, { hint: string; cta: string }> = {
  generate: { hint: "Describe what the post is about and we'll draft it.", cta: "Generate post" },
  rephrase: { hint: "Say it differently in the tone you pick.", cta: "Rephrase" },
  remodel: { hint: "Reshape your post so it reads naturally on one network.", cta: "Remodel" },
  grammar: { hint: "Fix spelling, grammar and punctuation only.", cta: "Fix grammar" },
};

/** AI actions that sit right under the editor: one click for quick fixes, a small panel for the rest. */
export function AiToolbar({ selectedPlatforms }: { selectedPlatforms: PlatformKey[] }) {
  const { text, applyAi, undoAi, previousText } = useComposeStore();
  const [panel, setPanel] = useState<Mode | null>(null);
  const [running, setRunning] = useState<Mode | null>(null);
  const [tone, setTone] = useState<Tone>("friendly");
  const [platform, setPlatform] = useState<PlatformKey>(selectedPlatforms[0] ?? "x");
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function run(mode: Mode) {
    const source = mode === "generate" ? idea : text;
    if (!source.trim()) {
      toast.info(mode === "generate" ? "Describe your idea first." : "Write some text first.");
      return;
    }
    setRunning(mode);
    setResult(null);
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: source,
          tone,
          platform: mode === "remodel" || mode === "generate" ? platform : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setResult(json.text as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(null);
    }
  }

  function choose(a: (typeof ACTIONS)[number]) {
    setResult(null);
    if (a.instant) {
      setPanel(null);
      void run(a.mode);
    } else {
      setPanel((p) => (p === a.mode ? null : a.mode));
    }
  }

  const needsTone = panel === "generate" || panel === "remodel" || panel === "rephrase";
  const needsPlatform = panel === "remodel" || panel === "generate";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <HugeiconsIcon icon={AiMagicIcon} size={15} />
          AI
        </span>
        {ACTIONS.map((a) => (
          <button
            key={a.mode}
            type="button"
            onClick={() => choose(a)}
            disabled={running !== null}
            aria-pressed={panel === a.mode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              panel === a.mode || running === a.mode
                ? "border-foreground bg-white/10"
                : "border-border text-muted hover:border-white/25 hover:text-foreground",
              running === a.mode && "animate-pulse",
            )}
          >
            {running === a.mode ? "Working…" : a.label}
          </button>
        ))}
        {previousText !== null && (
          <Button size="sm" variant="ghost" onClick={undoAi} icon={<HugeiconsIcon icon={Undo02Icon} size={15} />}>
            Undo
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {panel && (
          <motion.div
            key={panel}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="mt-3 rounded-2xl border border-border bg-white/[0.03] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted">{copy[panel].hint}</p>
              <button
                type="button"
                aria-label="Close AI options"
                onClick={() => setPanel(null)}
                className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={15} />
              </button>
            </div>

            {panel === "generate" && (
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={3}
                placeholder="e.g. Announce our spring sale, 20% off all week"
                className="mt-3 w-full resize-none rounded-xl border border-border bg-background/60 px-4 py-3 text-base outline-none focus:border-white/40"
              />
            )}

            <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
              {needsTone && (
                <div>
                  <p className="mb-1.5 text-xs text-muted">Tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tones.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                          tone === t ? "border-foreground bg-white/10" : "border-border text-muted hover:text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {needsPlatform && (
                <div>
                  <p className="mb-1.5 text-xs text-muted">For</p>
                  <Select<PlatformKey>
                    className="w-44"
                    ariaLabel="Target network"
                    value={platform}
                    onChange={setPlatform}
                    options={PLATFORM_LIST.map((p) => ({
                      value: p.key,
                      label: p.name,
                      icon: <PlatformIcon platform={p.key} size={12} />,
                    }))}
                  />
                </div>
              )}
              <Button size="sm" onClick={() => run(panel)} loading={running === panel}>
                {copy[panel].cta}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <div className="mt-3 rounded-2xl border border-border bg-background/60 p-4">
          <p className="mb-2 text-xs font-medium text-muted">Suggestion</p>
          <p className="whitespace-pre-wrap text-[15px] leading-6">{result}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                applyAi(result);
                setResult(null);
                setPanel(null);
                toast.success("Added to your post");
              }}
            >
              Use this
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
