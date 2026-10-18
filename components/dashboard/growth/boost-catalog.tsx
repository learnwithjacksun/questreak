"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Rocket01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { TelegramIcon, WhatsappIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { placeBoostOrder } from "@/app/actions/growth";
import { Field } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PlatformIcon, Skeleton } from "@/components/ui/primitives";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  GROWTH_ORDER,
  categoryLabel,
  detectPlatform,
  growthPlatformName,
  qualityOf,
  type GrowthPlatformKey,
} from "@/lib/growth";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { formatNgn, smmTotal } from "@/lib/pricing";
import type { SmmService } from "@/lib/providers/smm";
import { PaymentNotice } from "./payment-notice";

type Tagged = { s: SmmService; platform: GrowthPlatformKey };

/** Logo for platforms we have artwork for; a branded tile for the rest. */
function GrowthLogo({ platform, size = 28 }: { platform: GrowthPlatformKey; size?: number }) {
  if (platform in PLATFORMS) return <PlatformIcon platform={platform as PlatformKey} size={size} />;
  const box = size + 12;
  const tile: Record<string, { icon: typeof TelegramIcon; bg: string }> = {
    telegram: { icon: TelegramIcon, bg: "#27a6e5" },
    whatsapp: { icon: WhatsappIcon, bg: "#25d366" },
    potato: { icon: UserGroupIcon, bg: "#d98a3d" },
  };
  const t = tile[platform] ?? { icon: Rocket01Icon, bg: "#52525b" };
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: box, height: box, backgroundColor: t.bg }}
    >
      <HugeiconsIcon icon={t.icon} size={size * 0.7} color="white" />
    </span>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="py-6 first:pt-0 last:pb-0"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-6 place-items-center rounded-full border border-border text-xs font-medium tabular-nums">
          {n}
        </span>
        <div>
          <h2 className="font-semibold leading-none">{title}</h2>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

export function BoostCatalog() {
  const { data, isLoading, isError, refetch } = useQuery<{ services: SmmService[] }>({
    queryKey: ["growth", "services"],
    queryFn: async () => {
      const res = await fetch("/api/growth/services");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load services");
      return json;
    },
    staleTime: 5 * 60_000,
  });

  const [platform, setPlatform] = useState<GrowthPlatformKey | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);

  const tagged = useMemo<Tagged[]>(
    () => (data?.services ?? []).map((s) => ({ s, platform: detectPlatform(s.category) })),
    [data],
  );

  const platforms = useMemo(() => {
    const present = new Set(tagged.map((t) => t.platform));
    return GROWTH_ORDER.filter((k) => present.has(k));
  }, [tagged]);

  const categories = useMemo<SelectOption[]>(() => {
    if (!platform) return [];
    const seen = new Map<string, string>();
    for (const t of tagged) if (t.platform === platform && !seen.has(t.s.category)) seen.set(t.s.category, categoryLabel(t.s.category));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [tagged, platform]);

  const qualities = useMemo<(SelectOption<number> & { service: SmmService })[]>(() => {
    if (!category) return [];
    const list = tagged
      .filter((t) => t.s.category === category)
      .map((t, i) => ({ ...t, q: qualityOf(t.s.name, t.s.category), i }))
      .sort((a, b) => a.q.rank - b.q.rank || a.i - b.i);
    const counts = new Map<string, number>();
    for (const x of list) counts.set(x.q.label, (counts.get(x.q.label) ?? 0) + 1);
    return list.map((x) => ({
      value: x.s.id,
      label: counts.get(x.q.label)! > 1 ? `${x.q.label} · #${x.s.id}` : x.q.label,
      description: `${formatNgn(x.s.ratePer1000Ngn)} per 1,000`,
      service: x.s,
    }));
  }, [tagged, category]);

  const service = qualities.find((q) => q.value === serviceId)?.service ?? null;

  function pickPlatform(p: GrowthPlatformKey) {
    if (p === platform) return;
    setPlatform(p);
    // Auto-advance when there is only one category to choose from.
    const cats = new Set(tagged.filter((t) => t.platform === p).map((t) => t.s.category));
    const only = cats.size === 1 ? [...cats][0] : null;
    setCategory(only);
    const opts = only ? tagged.filter((t) => t.s.category === only) : [];
    setServiceId(opts.length === 1 ? opts[0].s.id : null);
  }

  function pickCategory(c: string) {
    setCategory(c);
    const opts = tagged.filter((t) => t.s.category === c);
    setServiceId(opts.length === 1 ? opts[0].s.id : null);
  }

  return (
    <>
      <PaymentNotice />

      {isLoading ? (
        <div className="card p-6">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : isError || platforms.length === 0 ? (
        <EmptyState
          icon={Rocket01Icon}
          title="Services unavailable"
          description="We couldn't load boost services right now. This is usually temporary."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="card divide-y divide-border p-6">
          <Step n={1} title="Choose a platform">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {platforms.map((p) => {
                const on = p === platform;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickPlatform(p)}
                    className={`relative flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 transition-colors ${
                      on ? "border-foreground bg-white/[0.06]" : "border-border hover:border-white/25 hover:bg-white/[0.03]"
                    }`}
                  >
                    {on && (
                      <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-foreground text-background">
                        <HugeiconsIcon icon={Tick02Icon} size={12} />
                      </span>
                    )}
                    <GrowthLogo platform={p} />
                    <span className="text-sm font-medium">{growthPlatformName(p)}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          <AnimatePresence initial={false}>
            {platform && (
              <Step key="category" n={2} title="Choose a service" hint={`What do you want to boost on ${growthPlatformName(platform)}?`}>
                <Select
                  ariaLabel="Service category"
                  placeholder="Select a service"
                  value={category}
                  onChange={pickCategory}
                  options={categories}
                  searchable={categories.length > 8}
                />
              </Step>
            )}

            {category && (
              <Step key="quality" n={3} title="Choose quality" hint="Higher quality usually means better retention.">
                <Select<number>
                  ariaLabel="Quality"
                  placeholder="Select quality"
                  value={serviceId}
                  onChange={setServiceId}
                  options={qualities}
                />
              </Step>
            )}

            {service && (
              <Step key={`order-${service.id}`} n={4} title="Order details">
                <OrderForm service={service} platform={platform!} />
              </Step>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

function OrderForm({ service, platform }: { service: SmmService; platform: GrowthPlatformKey }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        link: z.string().trim().url("Enter a valid link, including https://"),
        quantity: z.coerce
          .number({ error: "Enter a quantity" })
          .int("Whole numbers only")
          .min(service.min, `Minimum is ${service.min.toLocaleString()}`)
          .max(service.max, `Maximum is ${service.max.toLocaleString()}`),
      }),
    [service],
  );
  type Values = { link: string; quantity: number };
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: { link: "", quantity: service.min },
  });
  const qty = Number(useWatch({ control, name: "quantity" })) || 0;
  const total = qty > 0 ? smmTotal(service.ratePer1000Ngn, qty) : 0;

  function onSubmit(values: Values) {
    startTransition(async () => {
      const res = await placeBoostOrder({ serviceId: service.id, ...values });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setPlaced(true);
      router.refresh();
    });
  }

  if (placed) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-6 text-center">
        <p className="text-lg font-semibold">Order saved</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          It&apos;s waiting for payment. Online payments aren&apos;t available yet, so nothing has been charged or started.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              reset({ link: "", quantity: service.min });
              setPlaced(false);
            }}
          >
            Place another
          </Button>
          <Link
            href="/dashboard/growth/orders"
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-[#1a1a24]"
          >
            View orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 md:grid-cols-[1fr_minmax(0,18rem)]">
      <div className="space-y-4">
        <Field
          label="Link"
          placeholder="https://"
          inputMode="url"
          autoComplete="off"
          error={errors.link?.message}
          {...register("link")}
        />
        <Field
          label="Quantity"
          type="number"
          inputMode="numeric"
          min={service.min}
          max={service.max}
          error={errors.quantity?.message}
          {...register("quantity")}
        />
        <p className="text-xs text-muted">
          Min {service.min.toLocaleString()} · Max {service.max.toLocaleString()}
        </p>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-background/60 p-4">
        <div className="flex items-start gap-3">
          <GrowthLogo platform={platform} size={18} />
          <p className="text-sm font-medium leading-5">{service.name.replace(/&amp;/g, "&")}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {service.refill && <Badge tone="success">Refill</Badge>}
          {service.cancel && <Badge>Cancellable</Badge>}
        </div>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Rate</dt>
            <dd className="tabular-nums">{formatNgn(service.ratePer1000Ngn)} / 1,000</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Total</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatNgn(total)}</dd>
          </div>
        </dl>
        <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
          Place order
        </Button>
        <p className="mt-3 text-center text-xs text-muted">You won&apos;t be charged yet.</p>
      </aside>
    </form>
  );
}
