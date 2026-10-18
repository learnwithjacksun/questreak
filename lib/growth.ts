import type { PlatformKey } from "@/lib/platforms";

/** Networks the boost supplier can serve. Superset of the networks we publish to. */
export type GrowthPlatformKey = PlatformKey | "telegram" | "whatsapp" | "potato" | "other";

type Matcher = { key: GrowthPlatformKey; name: string; test: RegExp };

// Order matters: first match wins. `prefix` strips the network name from a category label.
const MATCHERS: Matcher[] = [
  { key: "tiktok", name: "TikTok", test: /^\s*tik\s?tok\b/i },
  { key: "instagram", name: "Instagram", test: /^\s*insta(gram)?\b/i },
  { key: "facebook", name: "Facebook", test: /^\s*(face\s?book|fb)\b/i },
  { key: "youtube", name: "YouTube", test: /^\s*you\s?tube\b/i },
  { key: "x", name: "X", test: /^\s*(twitter|x)\b/i },
  { key: "linkedin", name: "LinkedIn", test: /^\s*linked\s?in\b/i },
  { key: "threads", name: "Threads", test: /^\s*threads\b/i },
  { key: "pinterest", name: "Pinterest", test: /^\s*pinterest\b/i },
  { key: "telegram", name: "Telegram", test: /^\s*telegram\b/i },
  { key: "whatsapp", name: "WhatsApp", test: /^\s*whats\s?app\b/i },
  { key: "potato", name: "Potato Chat", test: /^\s*potato\s?chat\b/i },
];

export const GROWTH_ORDER: GrowthPlatformKey[] = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "telegram",
  "whatsapp",
  "x",
  "linkedin",
  "threads",
  "pinterest",
  "potato",
  "other",
];

export function growthPlatformName(key: GrowthPlatformKey) {
  return MATCHERS.find((m) => m.key === key)?.name ?? "Other";
}

export function detectPlatform(category: string): GrowthPlatformKey {
  return MATCHERS.find((m) => m.test.test(category))?.key ?? "other";
}

/** "Tiktok Followers" -> "Followers", "Telegram - Auto Views" -> "Auto Views". */
export function categoryLabel(category: string) {
  const m = MATCHERS.find((x) => x.test.test(category));
  const rest = m ? category.replace(m.test, "").replace(/^[\s\-–:]+/, "").trim() : category.trim();
  const label = rest || category.trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function decode(s: string) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const QUALITY = /\b(low|average|medium|high|premium)\s+quality\b/i;

/**
 * Turns a supplier service name into the choice the buyer cares about:
 * "(Average Quality)" -> "Average quality", "(Love ❤️)" -> "Love ❤️", otherwise "Standard".
 * `rank` keeps Average first, High second, everything else after.
 */
export function qualityOf(name: string, category = ""): { label: string; rank: number } {
  const clean = decode(name);
  const q = clean.match(QUALITY);
  if (q) {
    const word = q[1].toLowerCase();
    const label = `${word.charAt(0).toUpperCase()}${word.slice(1)} quality`;
    const rank = word === "average" || word === "medium" || word === "low" ? 0 : word === "high" ? 1 : 2;
    return { label, rank };
  }
  const paren = clean.match(/\(\s*([^)]+?)\s*\)/);
  if (!paren) return { label: "Standard", rank: 2 };

  // Variants like "(Love ❤️)" or "(Option A)" read well on their own.
  if (/\p{L}/u.test(paren[1])) return { label: paren[1], rank: 2 };

  // Emoji-only variants: keep any wording before the brackets, minus the network and category words.
  let lead = clean.replace(/\s*\(.*$/, "").trim();
  const m = MATCHERS.find((x) => x.test.test(lead));
  if (m) lead = lead.replace(m.test, "").replace(/^[\s\-–:]+/, "");
  const cat = categoryLabel(category).toLowerCase();
  if (cat && lead.toLowerCase() === cat) lead = "";
  return { label: `${lead} ${paren[1]}`.trim(), rank: 2 };
}
