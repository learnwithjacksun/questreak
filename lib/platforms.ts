import {
  BlueskyIcon,
  Facebook01Icon,
  MastodonIcon,
} from "@hugeicons/core-free-icons";

export type PlatformKey =
  | "facebook"
  | "x"
  | "instagram"
  | "linkedin"
  | "threads"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "bluesky"
  | "mastodon";

export const PLATFORM_KEYS = [
  "facebook",
  "x",
  "instagram",
  "linkedin",
  "threads",
  "tiktok",
  "youtube",
  "pinterest",
  "bluesky",
  "mastodon",
] as const satisfies readonly PlatformKey[];

export type PlatformMeta = {
  key: PlatformKey;
  name: string;
  /** Logo file in /public/platforms. Null when the network is drawn as a coloured tile instead. */
  logo: string | null;
  /** Tile fallback used when there is no logo file. */
  tile?: { icon: typeof Facebook01Icon; bg: string };
  /** How the logo is framed: full-bleed square icon, circle crop, or a transparent mark. */
  shape: "square" | "circle" | "mark";
  /** Default maximum post text length (Mastodon instances can differ). */
  charLimit: number;
  /** Highlight in "popular" lists. */
  priority: boolean;
  /** What a connected account is called on this network. */
  accountKind: string;
};

export const PLATFORMS: Record<PlatformKey, PlatformMeta> = {
  facebook: { key: "facebook", name: "Facebook", logo: "/platforms/facebook.jpg", shape: "circle", charLimit: 63206, priority: true, accountKind: "Page" },
  x: { key: "x", name: "X", logo: "/platforms/x.jpg", shape: "square", charLimit: 280, priority: true, accountKind: "Profile" },
  instagram: { key: "instagram", name: "Instagram", logo: "/platforms/instagram.svg", shape: "mark", charLimit: 2200, priority: true, accountKind: "Business account" },
  linkedin: { key: "linkedin", name: "LinkedIn", logo: "/platforms/linkedin.png", shape: "square", charLimit: 3000, priority: true, accountKind: "Profile" },
  threads: { key: "threads", name: "Threads", logo: "/platforms/threads.jpg", shape: "square", charLimit: 500, priority: false, accountKind: "Profile" },
  tiktok: { key: "tiktok", name: "TikTok", logo: "/platforms/tiktok.jpg", shape: "square", charLimit: 2200, priority: false, accountKind: "Creator account" },
  youtube: { key: "youtube", name: "YouTube", logo: "/platforms/youtube.svg", shape: "mark", charLimit: 5000, priority: false, accountKind: "Channel" },
  pinterest: { key: "pinterest", name: "Pinterest", logo: "/platforms/pinterest.svg", shape: "mark", charLimit: 500, priority: false, accountKind: "Profile" },
  bluesky: { key: "bluesky", name: "Bluesky", logo: null, tile: { icon: BlueskyIcon, bg: "#0085ff" }, shape: "square", charLimit: 300, priority: false, accountKind: "Account" },
  mastodon: { key: "mastodon", name: "Mastodon", logo: null, tile: { icon: MastodonIcon, bg: "#6364ff" }, shape: "square", charLimit: 500, priority: false, accountKind: "Account" },
};

export const PLATFORM_LIST = PLATFORM_KEYS.map((k) => PLATFORMS[k]);

export function isPlatformKey(v: string): v is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(v);
}
