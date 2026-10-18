/** Pure text helpers shared by the Compose screen and the publishing adapters. */

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/g;

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

export function firstUrl(text: string): string | undefined {
  return extractUrls(text)[0];
}

export function graphemeLength(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let n = 0;
    for (const _ of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
      void _;
      n++;
    }
    return n;
  }
  return Array.from(text).length;
}

const wide = (cp: number) =>
  (cp >= 0x1100 && cp <= 0x11ff) ||
  (cp >= 0x2e80 && cp <= 0xa4cf) ||
  (cp >= 0xac00 && cp <= 0xd7a3) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) ||
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x1f300 && cp <= 0x1faff) || // emoji count double on X
  (cp >= 0x20000 && cp <= 0x3ffff);

/** Approximation of X's weighted length: every link counts 23, CJK and emoji count 2. */
export function xLength(text: string): number {
  const withoutUrls = text.replace(URL_RE, "");
  let n = extractUrls(text).length * 23;
  for (const ch of withoutUrls) n += wide(ch.codePointAt(0)!) ? 2 : 1;
  return n;
}

/** Length as each network counts it. */
export function countFor(platform: string, text: string): number {
  switch (platform) {
    case "x":
      return xLength(text);
    case "bluesky":
      return graphemeLength(text);
    default:
      return Array.from(text).length;
  }
}

/** First line, trimmed to `max` characters; used for YouTube/Pinterest titles. */
export function toTitle(text: string, max: number): string {
  const line = text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
  const chars = Array.from(line);
  return chars.length <= max ? line : `${chars.slice(0, max - 1).join("")}…`;
}

export function hashtags(text: string): string[] {
  return [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
}

/**
 * LinkedIn's "little text" format treats ( ) [ ] { } < > @ | ~ _ * \\ as markup. Unescaped, they
 * truncate the post. `#` is left alone so hashtags still link.
 */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, "\\$&");
}

export type BlueskyFacet = {
  index: { byteStart: number; byteEnd: number };
  features: ({ $type: "app.bsky.richtext.facet#link"; uri: string } | { $type: "app.bsky.richtext.facet#tag"; tag: string } | { $type: "app.bsky.richtext.facet#mention"; did: string })[];
};

/** Rich-text facets need UTF-8 byte offsets, not string indexes. */
export function blueskyFacets(
  text: string,
  resolveMention?: (handle: string) => string | undefined,
): BlueskyFacet[] {
  const enc = new TextEncoder();
  const byteIndex = (charIndex: number) => enc.encode(text.slice(0, charIndex)).length;
  const facets: BlueskyFacet[] = [];

  for (const m of text.matchAll(URL_RE)) {
    const start = m.index!;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + m[0].length) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const start = m.index! + m[1].length;
    const tag = m[2];
    if (tag.length > 64 || /^\d+$/.test(tag)) continue;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + tag.length + 1) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
    });
  }
  if (resolveMention) {
    for (const m of text.matchAll(/(^|\s)@([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})/g)) {
      const did = resolveMention(m[2]);
      if (!did) continue;
      const start = m.index! + m[1].length;
      facets.push({
        index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + m[2].length + 1) },
        features: [{ $type: "app.bsky.richtext.facet#mention", did }],
      });
    }
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}
