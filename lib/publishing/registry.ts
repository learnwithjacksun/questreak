import type { PlatformKey } from "@/lib/platforms";
import { bluesky } from "./providers/bluesky";
import { facebook, instagram } from "./providers/meta";
import { linkedin } from "./providers/linkedin";
import { mastodon } from "./providers/mastodon";
import { pinterest } from "./providers/pinterest";
import { threads } from "./providers/threads";
import { tiktok } from "./providers/tiktok";
import { x } from "./providers/x";
import { youtube } from "./providers/youtube";
import type { Provider } from "./types";

export const PROVIDERS: Record<PlatformKey, Provider> = {
  facebook,
  instagram,
  x,
  linkedin,
  threads,
  tiktok,
  youtube,
  pinterest,
  bluesky,
  mastodon,
};

export function missingEnv(platform: PlatformKey): string[] {
  return PROVIDERS[platform].env.filter((name) => !process.env[name]);
}

export function isConfigured(platform: PlatformKey): boolean {
  return missingEnv(platform).length === 0;
}

/** The provider that owns the sign-in flow (Instagram signs in through Meta). */
export function connectProvider(platform: PlatformKey): Provider {
  const p = PROVIDERS[platform];
  return p.connectVia ? PROVIDERS[p.connectVia] : p;
}

export type ConnectMethod = "oauth" | "credentials" | "instance";

export const CONNECT_METHOD: Record<PlatformKey, ConnectMethod> = {
  facebook: "oauth",
  instagram: "oauth",
  x: "oauth",
  linkedin: "oauth",
  threads: "oauth",
  tiktok: "oauth",
  youtube: "oauth",
  pinterest: "oauth",
  bluesky: "credentials",
  mastodon: "instance",
};

/** Safe-to-expose connection status per network (never includes secrets). */
export function platformStatuses(): Record<PlatformKey, { configured: boolean; missing: string[]; method: ConnectMethod }> {
  const out = {} as Record<PlatformKey, { configured: boolean; missing: string[]; method: ConnectMethod }>;
  for (const key of Object.keys(PROVIDERS) as PlatformKey[]) {
    const missing = missingEnv(key);
    out[key] = { configured: missing.length === 0, missing, method: CONNECT_METHOD[key] };
  }
  return out;
}
