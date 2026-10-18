"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, Undo02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { PLATFORM_LIST, type PlatformKey } from "@/lib/platforms";
import { useComposeStore } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";

type Mode = "generate" | "rephrase" | "remodel" | "grammar";
const tones = ["friendly", "professional", "playful", "bold", "concise"] as const;

const copy: Record<Mode, { hint: string; cta: string }> = {
  generate: { hint: "Describe what the post is about and we'll draft it.", cta: "Generate post" },
  rephrase: { hint: "Say it differently in the tone you pick.", cta: "Rephrase" },
  remodel: { hint: "Reshape your post so it reads naturally on one network.", cta: "Remodel" },
  grammar: { hint: "Fix spelling, grammar and punctuation only.", cta: "Fix grammar" },
};

export function AiPanel({ selectedPlatforms }: { selectedPlatforms: PlatformKey[] }) {
  const { text, applyAi, undoAi, previousText } = useComposeStore();
  const [mode, setMode] = useState<Mode>("generate");
  const [tone, setTone] = useState<(typeof tones)[number]>("friendly");
  const [platform, setPlatform] = useState<PlatformKey>(selectedPlatforms[0] ?? "x");
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const source = mode === "generate" ? idea : text;

  async function run() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  const needsTone = mode !== "grammar";
  const needsPlatform = mode === "remodel" || mode === "generate";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <HugeiconsIcon icon={AiMagicIcon} size={18} />
          AI assistant
        </h3>
        {previousText !== null && (
          <Button size="sm" variant="ghost" onClick={undoAi} icon={<HugeiconsIcon icon={Undo02Icon} size={15} />}>
            Undo last change
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Only runs when you ask. Nothing changes until you accept it.</p>

      <div role="tablist" aria-label="AI action" className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(
          [
            ["generate", "Generate"],
            ["rephrase", "Rephrase"],
            ["remodel", "Remodel"],
            ["grammar", "Fix grammar"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setResult(null);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              mode === value ? "border-foreground bg-white/10" : "border-border text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted">{copy[mode].hint}</p>

      {mode === "generate" && (
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="e.g. Announce our spring sale, 20% off all week"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background/60 px-4 py-3 text-base outline-none focus:border-white/40"
        />
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
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
      </div>

      <div className="mt-4">
        <Button
          onClick={run}
          loading={loading}
          disabled={!source.trim()}
          size="sm"
          title={!source.trim() ? (mode === "generate" ? "Describe your idea first" : "Write some text first") : undefined}
        >
          {copy[mode].cta}
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
          <p className="whitespace-pre-wrap text-[15px] leading-6">{result}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                applyAi(result);
                setResult(null);
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
