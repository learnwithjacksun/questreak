import { describe, expect, test } from "bun:test";
import { CAPABILITIES, validateForPlatform } from "../lib/publishing/capabilities";
import { chunkPlan } from "../lib/publishing/providers/tiktok";
import {
  blueskyFacets,
  countFor,
  escapeLittleText,
  extractUrls,
  graphemeLength,
  hashtags,
  toTitle,
  xLength,
} from "../lib/publishing/text";
import { optionProblems } from "../lib/publishing/option-rules";

describe("text helpers", () => {
  test("graphemeLength counts what a person sees", () => {
    expect(graphemeLength("hi")).toBe(2);
    expect(graphemeLength("👨‍👩‍👧")).toBe(1); // family emoji is many code points, one grapheme
    expect(graphemeLength("é")).toBe(1);
  });

  test("X counts every link as 23 and emoji as 2", () => {
    expect(xLength("hello")).toBe(5);
    expect(xLength("see https://example.com/a/very/long/path/that/goes/on")).toBe(4 + 23);
    expect(xLength("😀")).toBe(2);
    expect(countFor("x", "https://a.co")).toBe(23);
  });

  test("extractUrls ignores trailing punctuation", () => {
    expect(extractUrls("Visit https://example.com/page, then (https://b.io).")).toEqual(["https://example.com/page", "https://b.io"]);
  });

  test("hashtags", () => {
    expect(hashtags("ship it #launch and #v2_beta not#this")).toEqual(["launch", "v2_beta"]);
  });

  test("toTitle uses the first non-empty line and truncates", () => {
    expect(toTitle("\n\nFirst line\nsecond", 50)).toBe("First line");
    expect(toTitle("abcdefghij", 5)).toBe("abcd…");
  });

  test("LinkedIn little-text markup characters are escaped, hashtags are not", () => {
    expect(escapeLittleText("Hello (world) @you #tag a_b *c* [x] {y} <z> | ~")).toBe(
      "Hello \\(world\\) \\@you #tag a\\_b \\*c\\* \\[x\\] \\{y\\} \\<z\\> \\| \\~",
    );
  });
});

describe("Bluesky facets use UTF-8 byte offsets", () => {
  test("a link after multi-byte characters", () => {
    const text = "café 🎉 https://example.com/x";
    const facets = blueskyFacets(text);
    expect(facets).toHaveLength(1);
    const enc = new TextEncoder();
    const { byteStart, byteEnd } = facets[0].index;
    const slice = new TextDecoder().decode(enc.encode(text).slice(byteStart, byteEnd));
    expect(slice).toBe("https://example.com/x");
    expect(facets[0].features[0]).toEqual({ $type: "app.bsky.richtext.facet#link", uri: "https://example.com/x" });
  });

  test("hashtags and resolved mentions", () => {
    const text = "hi @alice.bsky.social #launch";
    const facets = blueskyFacets(text, (h) => (h === "alice.bsky.social" ? "did:plc:alice" : undefined));
    const kinds = facets.map((f) => f.features[0].$type);
    expect(kinds).toEqual(["app.bsky.richtext.facet#mention", "app.bsky.richtext.facet#tag"]);
    const enc = new TextEncoder();
    const slice = (i: number) => new TextDecoder().decode(enc.encode(text).slice(facets[i].index.byteStart, facets[i].index.byteEnd));
    expect(slice(0)).toBe("@alice.bsky.social");
    expect(slice(1)).toBe("#launch");
  });

  test("unresolved mentions and pure-number tags are skipped", () => {
    expect(blueskyFacets("@nobody.example #123")).toHaveLength(0);
  });
});

describe("per-network validation", () => {
  const img = { resourceType: "image" as const };
  const vid = { resourceType: "video" as const };

  test("Instagram and YouTube need media", () => {
    expect(validateForPlatform("instagram", "caption", [])).not.toEqual([]);
    expect(validateForPlatform("youtube", "title", [img]).join(" ")).toContain("doesn't accept photos");
    expect(validateForPlatform("youtube", "title", [vid])).toEqual([]);
  });

  test("text limits", () => {
    expect(validateForPlatform("x", "a".repeat(281), [])[0]).toContain("over the 280 limit");
    expect(validateForPlatform("bluesky", "a".repeat(301), [])).not.toEqual([]);
    expect(validateForPlatform("mastodon", "a".repeat(600), [], 5000)).toEqual([]);
  });

  test("photos and video can't be mixed except on Instagram and Threads", () => {
    expect(validateForPlatform("facebook", "x", [img, vid]).join(" ")).toContain("can't mix");
    expect(validateForPlatform("instagram", "x", [img, vid])).toEqual([]);
    expect(validateForPlatform("threads", "x", [img, vid])).toEqual([]);
  });

  test("counts", () => {
    expect(validateForPlatform("x", "x", Array(5).fill(img)).join(" ")).toContain("at most 4 photos");
    expect(CAPABILITIES.tiktok.requiresMedia).toBe(true);
  });

  test("empty posts are rejected", () => {
    expect(validateForPlatform("facebook", "  ", [])).not.toEqual([]);
  });
});

describe("TikTok chunking", () => {
  test("small files go in one chunk", () => {
    expect(chunkPlan(3_000_000)).toEqual({ chunkSize: 3_000_000, count: 1 });
  });

  test("files between 5 MB and 10 MB are one chunk that covers the whole file", () => {
    const size = 7_000_000;
    expect(chunkPlan(size)).toEqual({ chunkSize: size, count: 1 });
  });

  test("large files use 10 MB chunks and the last one absorbs the remainder", () => {
    const plan = chunkPlan(25_000_000);
    expect(plan).toEqual({ chunkSize: 10_000_000, count: 2 });
    // last chunk = 25M - 10M = 15M, within TikTok's 64 MB cap
  });
});

describe("option rules", () => {
  const tk = [{ id: "t1", platform: "tiktok" }];
  test("TikTok requires a privacy choice", () => {
    expect(optionProblems(tk, {}).join(" ")).toContain("choose who can view");
  });
  test("commercial content needs a disclosure choice and can't be private", () => {
    expect(optionProblems(tk, { tiktok: { t1: { privacy: "PUBLIC_TO_EVERYONE", commercial: true } } }).join(" ")).toContain("brand");
    expect(
      optionProblems(tk, { tiktok: { t1: { privacy: "SELF_ONLY", commercial: true, brandedContent: true } } }).join(" "),
    ).toContain("can't be private");
    expect(optionProblems(tk, { tiktok: { t1: { privacy: "PUBLIC_TO_EVERYONE", commercial: true, yourBrand: true } } })).toEqual([]);
  });
});
