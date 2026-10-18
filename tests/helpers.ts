export type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Parsed body: JSON, form fields, or multipart entries (files become { file, type, size }). */
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

type Handler = (call: Call) => Response | Promise<Response> | undefined;

const real = globalThis.fetch;

function parseBody(body: unknown): unknown {
  if (body == null) return undefined;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
  if (body instanceof FormData) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of body.entries()) {
      out[k] = typeof v === "string" ? v : { file: (v as File).name, type: (v as File).type, size: (v as File).size };
    }
    return out;
  }
  if (body instanceof Uint8Array) return { bytes: body.length };
  if (body instanceof ArrayBuffer) return { bytes: body.byteLength };
  if (typeof (body as ReadableStream).getReader === "function") return { stream: true };
  return String(body);
}

/** Replaces global fetch. Unmatched requests fail loudly so a wrong URL is obvious. */
export function mockFetch(handler: Handler) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    const call: Call = { url, method: (init.method ?? "GET").toUpperCase(), headers, body: parseBody(init.body) };
    calls.push(call);
    const res = await handler(call);
    if (!res) throw new Error(`Unexpected request: ${call.method} ${url}`);
    return res;
  }) as typeof fetch;
  return calls;
}

export function restoreFetch() {
  globalThis.fetch = real;
}

export const ok = (body: unknown = {}, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

export const bytes = (n: number, type = "image/jpeg", init: ResponseInit = {}) =>
  new Response(new Uint8Array(n), { status: 200, headers: { "content-type": type, "content-length": String(n) }, ...init });

export const account = (over: Partial<import("../lib/publishing/types").AccountCtx> = {}) =>
  ({
    id: "a1",
    userId: "u1",
    platform: "bluesky",
    externalId: "did:plc:abc",
    handle: "me.bsky.social",
    displayName: "Me",
    meta: {},
    accessToken: "token",
    ...over,
  }) as import("../lib/publishing/types").AccountCtx;

export const input = (over: Partial<import("../lib/publishing/types").PublishInput> = {}) =>
  ({ text: "Hello world", media: [], options: {}, accountId: "a1", ...over }) as import("../lib/publishing/types").PublishInput;

export const CLOUD = "https://res.cloudinary.com/demo/image/upload/v1/questreak/u1/photo.png";
export const CLOUD_VIDEO = "https://res.cloudinary.com/demo/video/upload/v1/questreak/u1/clip.mp4";
