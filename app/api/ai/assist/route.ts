import Anthropic from "@anthropic-ai/sdk";
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    "Reply with ONLY the final post text: no quotes, preface, labels or explanations. Do not add emojis or hashtags unless the original already uses them.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
    });
    const out = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!out) return NextResponse.json({ error: "No result. Try again." }, { status: 502 });
    return NextResponse.json({ text: limit ? out.slice(0, limit) : out });
  } catch {
    return NextResponse.json({ error: "The AI assistant is unavailable right now." }, { status: 502 });
  }
}
