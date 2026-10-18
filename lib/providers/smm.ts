import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { applyMarkup, round2 } from "@/lib/pricing";

/**
 * SMM panel client (standard v2 API: POST key + action).
 * Supplier bills in USD per 1,000 units; we convert to NGN and add our markup.
 */

const serviceSchema = z.object({
  service: z.coerce.number(),
  name: z.string(),
  type: z.string().optional().default("Default"),
  category: z.string().default("Other"),
  rate: z.coerce.number(),
  min: z.coerce.number(),
  max: z.coerce.number(),
  refill: z.boolean().optional().default(false),
  cancel: z.boolean().optional().default(false),
});

const statusSchema = z.object({
  charge: z.coerce.number().optional(),
  start_count: z.coerce.number().optional(),
  status: z.string(),
  remains: z.coerce.number().optional(),
  currency: z.string().optional(),
});

export type SmmService = {
  id: number;
  name: string;
  type: string;
  category: string;
  /** Final price in NGN per 1,000 (markup included). */
  ratePer1000Ngn: number;
  /** Supplier cost in NGN per 1,000. */
  costPer1000Ngn: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
};

export class SmmError extends Error {}

function env() {
  const url = process.env.SMM_BASE_URL;
  const key = process.env.SMM_API_KEY ?? process.env.SMM_API_key;
  if (!url || !key) throw new SmmError("SMM provider is not configured");
  return { url, key };
}

async function call(action: string, params: Record<string, string> = {}) {
  const { url, key } = env();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key, action, ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new SmmError(`SMM provider responded ${res.status}`);
  const json = await res.json();
  if (json && typeof json === "object" && !Array.isArray(json) && "error" in json) {
    throw new SmmError(String((json as { error: unknown }).error));
  }
  return json as unknown;
}

let cache: { at: number; data: SmmService[] } | null = null;
const TTL = 5 * 60 * 1000;

export async function fetchSmmServices(): Promise<SmmService[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const data = await loadServices();
  cache = { at: Date.now(), data };
  return data;
}

async function loadServices(): Promise<SmmService[]> {
  const raw = await call("services");
  const parsed = z.array(serviceSchema).safeParse(raw);
  if (!parsed.success) throw new SmmError("Unexpected response from SMM provider");
  const { usdNgnRate, markupPercent } = config;
  return parsed.data.map((s) => {
    const cost = round2(s.rate * usdNgnRate);
    return {
      id: s.service,
      name: s.name,
      type: s.type,
      category: s.category,
      costPer1000Ngn: cost,
      ratePer1000Ngn: applyMarkup(cost, markupPercent),
      min: s.min,
      max: s.max,
      refill: s.refill,
      cancel: s.cancel,
    };
  });
}

/** Places an order with the supplier. Only call from `fulfillOrder` after payment. */
export async function addSmmOrder(input: {
  serviceId: number;
  link: string;
  quantity: number;
}) {
  const raw = await call("add", {
    service: String(input.serviceId),
    link: input.link,
    quantity: String(input.quantity),
  });
  const parsed = z.object({ order: z.coerce.number() }).safeParse(raw);
  if (!parsed.success) throw new SmmError("Supplier did not return an order id");
  return String(parsed.data.order);
}

export async function getSmmOrderStatus(orderId: string) {
  const raw = await call("status", { order: orderId });
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new SmmError("Unexpected status response");
  return parsed.data;
}
