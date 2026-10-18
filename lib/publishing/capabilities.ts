import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { countFor } from "./text";

/** What each network accepts. Pure data so the Compose screen and the server enforce the same rules. */
export type Capability = {
  /** The network will reject a post with no media. */
  requiresMedia: boolean;
  maxImages: number;
  maxVideos: number;
  /** Images and a video can be combined in one post. */
  mixed: boolean;
  /** Short hint shown next to the network in Compose. */
  hint: string;
};

export const CAPABILITIES: Record<PlatformKey, Capability> = {
  facebook: { requiresMedia: false, maxImages: 10, maxVideos: 1, mixed: false, hint: "Text, up to 10 photos or 1 video" },
  instagram: { requiresMedia: true, maxImages: 10, maxVideos: 10, mixed: true, hint: "Needs a photo or video (up to 10 in a carousel)" },
  x: { requiresMedia: false, maxImages: 4, maxVideos: 1, mixed: false, hint: "Text, up to 4 photos or 1 video" },
  linkedin: { requiresMedia: false, maxImages: 20, maxVideos: 1, mixed: false, hint: "Text, up to 20 photos or 1 video" },
  threads: { requiresMedia: false, maxImages: 20, maxVideos: 20, mixed: true, hint: "Text, plus up to 20 photos or videos" },
  tiktok: { requiresMedia: true, maxImages: 35, maxVideos: 1, mixed: false, hint: "Needs 1 video or up to 35 photos" },
  youtube: { requiresMedia: true, maxImages: 0, maxVideos: 1, mixed: false, hint: "Needs 1 video" },
  pinterest: { requiresMedia: true, maxImages: 5, maxVideos: 1, mixed: false, hint: "Needs 1 video or 1–5 photos" },
  bluesky: { requiresMedia: false, maxImages: 4, maxVideos: 1, mixed: false, hint: "Text, up to 4 photos or 1 video" },
  mastodon: { requiresMedia: false, maxImages: 4, maxVideos: 1, mixed: false, hint: "Text, up to 4 photos or 1 video" },
};

export type MediaKind = "image" | "video";

/** Everything wrong with sending this text and media to one network. Empty means it can go. */
export function validateForPlatform(
  platform: PlatformKey,
  text: string,
  media: { resourceType: MediaKind }[],
  limitOverride?: number,
): string[] {
  const cap = CAPABILITIES[platform];
  const name = PLATFORMS[platform].name;
  const errors: string[] = [];
  const images = media.filter((m) => m.resourceType === "image").length;
  const videos = media.length - images;

  const limit = limitOverride ?? PLATFORMS[platform].charLimit;
  const len = countFor(platform, text);
  if (len > limit) errors.push(`${name}: text is ${len - limit} over the ${limit.toLocaleString()} limit.`);

  if (cap.requiresMedia && media.length === 0) errors.push(`${name} needs ${cap.hint.replace(/^Needs /, "")}.`);
  if (!cap.requiresMedia && !text.trim() && media.length === 0) errors.push(`${name}: add some text or media.`);
  if (images > cap.maxImages) {
    errors.push(
      cap.maxImages === 0
        ? `${name} doesn't accept photos.`
        : `${name} accepts at most ${cap.maxImages} photo${cap.maxImages === 1 ? "" : "s"}.`,
    );
  }
  if (videos > cap.maxVideos) {
    errors.push(`${name} accepts at most ${cap.maxVideos} video${cap.maxVideos === 1 ? "" : "s"}.`);
  }
  if (!cap.mixed && images > 0 && videos > 0) errors.push(`${name} can't mix photos and a video in one post.`);
  return errors;
}
