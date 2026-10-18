import { PublishError } from "./types";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Init = RequestInit & { timeoutMs?: number };

/** fetch with a timeout and network errors turned into PublishError. */
export async function request(url: string | URL, init: Init = {}): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init;
  try {
    return await fetch(url, { ...rest, signal: rest.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    throw new PublishError(timedOut ? "The network timed out." : "Couldn't reach the network.", { retryable: true });
  }
}

/** Pulls the most useful message out of the many error shapes the networks use. */
export function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return typeof body === "string" && body ? body.slice(0, 300) : fallback;
  const b = body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const candidates = [
    b.error?.error_user_msg,
    b.error?.message,
    b.error_description,
    typeof b.error === "string" ? b.error : undefined,
    b.message,
    b.detail,
    b.title,
    b.errors?.[0]?.message,
    b.errors?.[0]?.detail,
    b.data?.error?.message,
    b.error?.log_id && b.error?.message,
  ];
  const first = candidates.find((c) => typeof c === "string" && c.trim());
  return first ? String(first).slice(0, 300) : fallback;
}

const isAuthStatus = (s: number) => s === 401;

/** Throws a readable PublishError for non-2xx responses; otherwise returns the parsed JSON body. */
export async function json<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  res: Response,
  network: string,
  opts: { authCodes?: (string | number)[] } = {},
): Promise<T> {
  const text = await res.text();
  let body: unknown = undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (res.ok) return body as T;

  const code = (body as any)?.error?.code ?? (body as any)?.code; // eslint-disable-line @typescript-eslint/no-explicit-any
  const reconnect =
    isAuthStatus(res.status) ||
    (opts.authCodes ?? []).some((c) => String(c) === String(code)) ||
    (body as any)?.error?.type === "OAuthException" || // eslint-disable-line @typescript-eslint/no-explicit-any
    (body as any)?.error === "invalid_token"; // eslint-disable-line @typescript-eslint/no-explicit-any
  const retryable = res.status === 429 || res.status >= 500;
  const message = errorMessage(body, `${network} returned ${res.status}.`);
  throw new PublishError(reconnect ? `${message} Reconnect the account and try again.` : message, {
    reconnect,
    retryable,
  });
}

export function form(data: Record<string, string | number | boolean | undefined | null>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== null) p.set(k, String(v));
  return p;
}

export function basicAuth(id: string, secret: string) {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new PublishError(`${name} is not configured on the server.`);
  return v;
}
