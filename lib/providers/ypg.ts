import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { applyMarkup } from "@/lib/pricing";

/**
 * YoungPG reseller API client. Prices are already in NGN.
 * `purchase` debits OUR wallet and is NOT retry-safe: on timeout/502, reconcile with
 * `listOrders()` before trying again. It must only be called from `fulfillOrder`.
 */

const envelope = z.object({
  success: z.boolean(),
  message: z.string().nullish(),
  data: z.unknown().optional(),
  meta: z.unknown().optional(),
});

export class YpgError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

function env() {
  const base = process.env.YPG_BASE_URL;
  const key = process.env.YPG_API_KEY;
  if (!base || !key) throw new YpgError("Accounts provider is not configured");
  // Accept the base URL with or without the /api/v1 suffix.
  return { base: base.replace(/\/+$/, "").replace(/\/api\/v1$/, ""), key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read-only calls get one retry on network errors, 429 and 5xx. Purchases are never retried. */
async function call(
  path: string,
  init: Parameters<typeof callOnce>[1] = {},
) {
  if ((init.method ?? "GET") !== "GET") return callOnce(path, init);
  try {
    return await callOnce(path, init);
  } catch (err) {
    const retryable =
      !(err instanceof YpgError) || err.status === 429 || (err.status !== undefined && err.status >= 500);
    if (!retryable) throw err;
    await sleep(Math.min((err instanceof YpgError ? err.retryAfter : undefined) ?? 1, 3) * 1000);
    return callOnce(path, init);
  }
}

async function callOnce(
  path: string,
  init: { method?: "GET" | "POST"; query?: Record<string, string | number | undefined>; body?: unknown } = {},
) {
  const { base, key } = env();
  const url = new URL(`${base}/api/v1${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "X-API-Key": key,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const json = envelope.safeParse(await res.json().catch(() => null));
  if (!res.ok || !json.success || !json.data.success) {
    const retry = Number(res.headers.get("Retry-After")) || undefined;
    throw new YpgError(
      (json.success && json.data.message) || `Provider responded ${res.status}`,
      res.status,
      retry,
    );
  }
  return json.data;
}

const listingSchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  price_ngn: z.coerce.number(),
  available_stock: z.coerce.number(),
  category_id: z.coerce.number().nullish(),
  subcategory_id: z.coerce.number().nullish(),
  category: z
    .union([z.string(), z.object({ title: z.string().optional(), name: z.string().optional() }).passthrough()])
    .nullish(),
  image: z.string().nullish(),
});

// Categories come back as { id, slug, title }; normalise to { id, name }.
const categorySchema = z
  .object({
    id: z.coerce.number(),
    title: z.string().optional(),
    name: z.string().optional(),
    image: z.string().nullish(),
  })
  .passthrough()
  .transform((c) => ({
    id: c.id,
    name: c.title ?? c.name ?? `Category ${c.id}`,
    image: c.image ?? undefined,
  }));

export type AccountListing = {
  slug: string;
  title: string;
  description?: string;
  stock: number;
  categoryId?: number;
  subcategoryId?: number;
  category?: string;
  image?: string;
  costNgn: number;
  priceNgn: number;
};

function toListing(l: z.infer<typeof listingSchema>): AccountListing {
  return {
    slug: l.slug,
    title: l.title,
    description: l.description ?? undefined,
    stock: l.available_stock,
    categoryId: l.category_id ?? undefined,
    subcategoryId: l.subcategory_id ?? undefined,
    category: typeof l.category === "string" ? l.category : (l.category?.title ?? l.category?.name),
    image: l.image ?? undefined,
    costNgn: l.price_ngn,
    priceNgn: applyMarkup(l.price_ngn, config.markupPercent),
  };
}

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function fetchCategories() {
  return cached("categories", 10 * 60_000, async () => {
    const res = await call("/categories");
    return z.array(categorySchema).parse(res.data);
  });
}

export async function fetchSubcategories(categoryId: number) {
  return cached(`sub:${categoryId}`, 10 * 60_000, async () => {
    const res = await call(`/categories/${categoryId}/subcategories`);
    return z.array(categorySchema).parse(res.data);
  });
}

export async function fetchListings(query: {
  categoryId?: number;
  subcategoryId?: number;
  search?: string;
  sort?: "sort_key" | "total_price" | "available_stock" | "title";
  direction?: "asc" | "desc";
  page?: number;
  perPage?: number;
}) {
  const res = await call("/listings", {
    query: {
      category_id: query.categoryId,
      subcategory_id: query.subcategoryId,
      search: query.search,
      sort: query.sort,
      direction: query.direction,
      page: query.page,
      per_page: query.perPage ?? 24,
    },
  });
  const items = z.array(listingSchema).parse(res.data).map(toListing);
  const meta = z
    .object({ total: z.coerce.number().optional(), last_page: z.coerce.number().optional() })
    .passthrough()
    .safeParse(res.meta);
  return {
    items,
    total: meta.success ? (meta.data.total ?? items.length) : items.length,
    pageCount: meta.success ? (meta.data.last_page ?? 1) : 1,
  };
}

export async function fetchListing(slug: string) {
  const res = await call(`/listings/${encodeURIComponent(slug)}`);
  return toListing(listingSchema.parse(res.data));
}

export async function purchaseAccounts(input: { slug: string; quantity: number }) {
  const res = await call("/purchase", { method: "POST", body: input });
  return z
    .object({
      order_id: z.coerce.string(),
      accounts: z.array(z.string()),
      amount_ngn: z.coerce.number(),
      new_balance_ngn: z.coerce.number().optional(),
    })
    .parse(res.data);
}

export async function listOrders() {
  const res = await call("/orders");
  return res.data;
}
