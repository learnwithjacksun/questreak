import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PLATFORM_KEYS, PLATFORMS } from "@/lib/platforms";
import { getSessionUserId } from "@/lib/session";

const bodySchema = z.object({
  mode: z.enum(["generate", "rephrase", "remodel", "grammar"]),
  text: z.string().max(5000).default(""),
  tone: z.enum(["professional", "friendly", "playful", "bold", "concise"]).default("friendly"),
  platform: z.enum(PLATFORM_KEYS).optional(),
  maxLength: z.number().int().positive().max(5000).optional(),
});

// Simple per-user, per-instance rate limit.
const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 15;
}

const instructions = {
  generate: (tone: string) =>
    `Write one social media post from the user's idea. Tone: ${tone}.`,
  rephrase: (tone: string) =>
    `Rewrite the user's post in a ${tone} tone, keeping the meaning and any links, @mentions and hashtags.`,
  remodel: (tone: string) =>
    `Restructure and improve the user's post for the target platform so it reads naturally there. Tone: ${tone}.`,
  grammar: () =>
    "Fix grammar, spelling and punctuation only. Do not change wording, tone or meaning beyond that.",
} as const;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The AI assistant isn't configured yet." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode, text, tone, platform, maxLength } = parsed.data;
  if (!text.trim()) {
    return NextResponse.json(
      { error: mode === "generate" ? "Describe what the post should be about." : "Write some text first." },
      { status: 400 },
    );
  }
  if (limited(userId)) {
    return NextResponse.json({ error: "Slow down a little and try again in a minute." }, { status: 429 });
  }

  const limit = maxLength ?? (platform ? PLATFORMS[platform].charLimit : undefined);
  const system = [
    "You are a social media writing assistant inside a posting tool.",
    instructions[mode](tone),
    platform ? `Target platform: ${PLATFORMS[platform].name}.` : "",
    limit ? `The result must be at most ${limit} characters.` : "",
    "Reply with ONLY the final post text: no quotes, preface, labels or explanations.",
    "Never invent facts: no dates, prices, discounts, names, links or claims that the user did not provide.",
    mode === "generate"
      ? "Keep it concise. Do not add emojis or hashtags unless the user's idea asks for them."
      : "Keep the length close to the original. Do not add new claims, emojis, hashtags or calls to action that the original does not already have.",
  ]
    .filter(Boolean)
    .join("\n");

  // The "-latest" aliases follow Google's current models, so they keep working when models retire.
  // Flash-Lite is fast (~1.5s) and plenty for short rewrites; regular Flash is the fallback.
  const primary = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest";

  const call = (model: string, disableThinking: boolean) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            temperature: mode === "grammar" ? 0.2 : 0.7,
            maxOutputTokens: 1024,
            // Short rewrites don't need reasoning: ~1.5s instead of ~6s. Some models reject this.
            ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

  async function generate(model: string) {
    let r = await call(model, true);
    if (r.status === 400) r = await call(model, false);
    return r;
  }

  const overloaded = (status: number) => [429, 500, 503, 504].includes(status);

  try {
    let res = await generate(primary).catch(() => null);
    if ((!res || overloaded(res.status)) && fallback !== primary) {
      if (res) console.warn("[ai/assist] primary model busy, falling back:", res.status);
      res = await generate(fallback).catch(() => null);
    }
    if (!res) throw new Error("Gemini request failed");

    if (!res.ok) {
      console.error("[ai/assist] Gemini error", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return NextResponse.json(
        {
          error:
            overloaded(res.status)
              ? "The AI assistant is busy right now. Try again in a moment."
              : "The AI assistant is unavailable right now.",
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) {
      return NextResponse.json({ error: "That text can't be processed. Try rewording it." }, { status: 422 });
    }
    const out = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!out) return NextResponse.json({ error: "No result. Try again." }, { status: 502 });
    return NextResponse.json({ text: limit ? out.slice(0, limit) : out });
  } catch (err) {
    console.error("[ai/assist]", err);
    return NextResponse.json({ error: "The AI assistant is unavailable right now." }, { status: 502 });
  }
}
