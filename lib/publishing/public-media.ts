import "server-only";
import { jwtVerify, SignJWT } from "jose";

/**
 * Some networks (TikTok photos) only fetch media from a domain the developer has verified.
 * Our files live on Cloudinary, so we serve them through a signed, short-lived URL on our own
 * domain (`/api/public-media/<token>`), which is the prefix to verify in the TikTok portal.
 */

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function publicMediaUrl(sourceUrl: string, ttlSeconds = 3600): Promise<string> {
  const token = await new SignJWT({ u: sourceUrl })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("public-media")
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // The extension helps picky consumers sniff the type; the route ignores it.
  return `${base}/api/public-media/${token}.jpg`;
}

export async function resolvePublicMedia(tokenWithExt: string): Promise<string | null> {
  try {
    const token = tokenWithExt.replace(/\.[a-z0-9]{2,4}$/i, "");
    const { payload } = await jwtVerify(token, key(), { audience: "public-media" });
    const url = payload.u;
    if (typeof url !== "string") return null;
    // Only ever proxy our own storage, never an arbitrary address.
    return /^https:\/\/res\.cloudinary\.com\//.test(url) ? url : null;
  } catch {
    return null;
  }
}
