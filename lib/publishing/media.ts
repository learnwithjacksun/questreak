import { PublishError } from "./types";
import { request } from "./http";

/**
 * Media helpers. Files live on Cloudinary, so many networks can pull them by public URL;
 * the ones that need bytes get them through `fetchBytes` / `fetchRange`.
 */

const CLOUDINARY = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)(.+)$/;

/** Inserts a Cloudinary transformation (e.g. "f_jpg,w_2048,q_auto"). Other URLs are returned unchanged. */
export function cloudinaryVariant(url: string, transformation: string): string {
  const m = url.match(CLOUDINARY);
  return m ? `${m[1]}${transformation}/${m[2]}` : url;
}

/** A JPEG no wider than `width`, for networks with image-format or size rules. */
export function jpegVariant(url: string, opts: { width?: number; quality?: string } = {}): string {
  const { width = 2048, quality = "auto" } = opts;
  return cloudinaryVariant(url, `c_limit,w_${width},f_jpg,q_${quality}`);
}

export function extensionOf(url: string): string {
  const path = url.split("?")[0].split("#")[0];
  return (path.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();
}

export function videoMime(url: string): string {
  switch (extensionOf(url)) {
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "video/mp4";
  }
}

export async function fetchBytes(
  url: string,
  opts: { maxBytes?: number } = {},
): Promise<{ data: Buffer; contentType: string }> {
  const res = await request(url, { timeoutMs: 120_000 });
  if (!res.ok) throw new PublishError(`Couldn't read the media file (${res.status}).`, { retryable: res.status >= 500 });
  const declared = Number(res.headers.get("content-length"));
  if (opts.maxBytes && declared > opts.maxBytes) {
    throw new PublishError(`The media file is ${(declared / 1e6).toFixed(1)} MB, over the ${(opts.maxBytes / 1e6).toFixed(0)} MB limit.`);
  }
  const data = Buffer.from(await res.arrayBuffer());
  if (opts.maxBytes && data.length > opts.maxBytes) {
    throw new PublishError(`The media file is over the ${(opts.maxBytes / 1e6).toFixed(0)} MB limit.`);
  }
  return { data, contentType: res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" };
}

/** Size in bytes without downloading the file. */
export async function remoteSize(url: string): Promise<number> {
  const head = await request(url, { method: "HEAD", timeoutMs: 20_000 }).catch(() => null);
  const len = Number(head?.headers.get("content-length"));
  if (head?.ok && len > 0) return len;
  // Some CDNs refuse HEAD: ask for the first byte and read the total from Content-Range.
  const probe = await request(url, { headers: { Range: "bytes=0-0" }, timeoutMs: 20_000 });
  const total = Number(probe.headers.get("content-range")?.split("/")[1]);
  await probe.body?.cancel().catch(() => undefined);
  if (total > 0) return total;
  throw new PublishError("Couldn't determine the size of the media file.");
}

/** Reads bytes [start, end] (inclusive) of a remote file. */
export async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  const res = await request(url, { headers: { Range: `bytes=${start}-${end}` }, timeoutMs: 120_000 });
  if (res.status !== 206 && res.status !== 200) {
    throw new PublishError(`Couldn't read the media file (${res.status}).`, { retryable: res.status >= 500 });
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // A server that ignores Range returns the whole file; slice it ourselves.
  return res.status === 200 ? buf.subarray(start, end + 1) : buf;
}

export function toBlob(data: Buffer, type: string): Blob {
  return new Blob([new Uint8Array(data)], { type });
}
