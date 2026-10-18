import type { PostOptions } from "@/models/post";

type Account = { id: string; platform: string };

/** Problems with the per-network settings of a post (pure, shared by Compose and the server). */
export function optionProblems(accounts: Account[], options: PostOptions | undefined): string[] {
  const out: string[] = [];

  for (const a of accounts.filter((x) => x.platform === "tiktok")) {
    const t = options?.tiktok?.[a.id];
    if (!t?.privacy) {
      out.push("TikTok: choose who can view the post.");
      continue;
    }
    if (t.commercial && !t.yourBrand && !t.brandedContent) {
      out.push("TikTok: say whether the content promotes your brand, a third party, or both.");
    }
    if (t.commercial && t.brandedContent && t.privacy === "SELF_ONLY") {
      out.push("TikTok: branded content can't be private. Pick a different visibility.");
    }
  }

  return [...new Set(out)];
}
