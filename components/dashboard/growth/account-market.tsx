"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { placeAccountOrder } from "@/app/actions/growth";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Badge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Select, type SelectOption } from "@/components/ui/select";
import { formatNgn, round2 } from "@/lib/pricing";
import type { AccountListing } from "@/lib/providers/ypg";
import { PaymentNotice } from "./payment-notice";

type Cat = { id: number; name: string; image?: string };
type Listings = { items: AccountListing[]; total: number; pageCount: number };

const PAGE_SIZE = 24;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function CategoryLogo({ src }: { src?: string }) {
  if (!src) return <span className="size-6 shrink-0 rounded-md bg-white/10" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-6 shrink-0 rounded-md object-cover" loading="lazy" />;
}

export function AccountMarket() {
  const [category, setCategory] = useState<number | null>(null);
  const [sub, setSub] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("sort_key:asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AccountListing | null>(null);
  const q = useDebounced(search.trim());

  const cats = useQuery({
    queryKey: ["growth", "categories"],
    queryFn: ({ signal }) => getJson<{ items: Cat[] }>("/api/growth/categories", signal),
    staleTime: 10 * 60_000,
  });
  const subs = useQuery({
    queryKey: ["growth", "subcategories", category],
    queryFn: ({ signal }) => getJson<{ items: Cat[] }>(`/api/growth/categories?parent=${category}`, signal),
    enabled: category !== null,
    staleTime: 10 * 60_000,
  });

  const [sortKey, direction] = sort.split(":");
  const listings = useQuery({
    queryKey: ["growth", "listings", { category, sub, q, sort, page }],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ sort: sortKey, direction, page: String(page) });
      if (category) p.set("categoryId", String(category));
      if (sub) p.set("subcategoryId", String(sub));
      if (q) p.set("search", q);
      return getJson<Listings>(`/api/growth/listings?${p}`, signal);
    },
    placeholderData: keepPreviousData,
  });

  const categoryOptions: SelectOption<number | 0>[] = [
    { value: 0, label: "All categories" },
    ...(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name, icon: <CategoryLogo src={c.image} /> })),
  ];
  const subOptions: SelectOption<number | 0>[] = [
    { value: 0, label: "All types" },
    ...(subs.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const data = listings.data;

  return (
    <>
      <PaymentNotice />

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem_11rem]">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search accounts"
            aria-label="Search accounts"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base outline-none focus:border-white/40"
          />
        </div>
        <Select<number>
          ariaLabel="Category"
          value={category ?? 0}
          searchable
          disabled={cats.isLoading}
          placeholder={cats.isLoading ? "Loading categories…" : "All categories"}
          options={categoryOptions}
          onChange={(v) => {
            setCategory(v || null);
            setSub(null);
            setPage(1);
          }}
        />
        <Select<string>
          ariaLabel="Sort"
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          options={[
            { value: "sort_key:asc", label: "Recommended" },
            { value: "total_price:asc", label: "Price: low to high" },
            { value: "total_price:desc", label: "Price: high to low" },
            { value: "available_stock:desc", label: "Most in stock" },
            { value: "title:asc", label: "Name" },
          ]}
        />
      </div>

      {category !== null && (subs.data?.items.length ?? 0) > 0 && (
        <Select<number>
          className="mt-3 md:w-72"
          ariaLabel="Account type"
          value={sub ?? 0}
          options={subOptions}
          searchable={subOptions.length > 8}
          onChange={(v) => {
            setSub(v || null);
            setPage(1);
          }}
        />
      )}

      <div className={`mt-6 transition-opacity ${listings.isPlaceholderData ? "opacity-60" : ""}`}>
        {listings.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/3" />
                <Skeleton className="mt-6 h-12 w-full" />
                <div className="mt-5 flex items-end justify-between">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-9 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.isError ? (
          <EmptyState
            icon={ShoppingCart01Icon}
            title="Couldn't load accounts"
            description={listings.error instanceof Error ? listings.error.message : "Please try again."}
            action={
              <Button variant="outline" size="sm" onClick={() => listings.refetch()}>
                Try again
              </Button>
            }
          />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={Search01Icon} title="No accounts found" description="Try a different category or search." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((l) => (
              <li key={l.slug} className="card flex flex-col p-5">
                <h3 className="line-clamp-3 font-medium leading-6">{l.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {l.category && <Badge>{l.category}</Badge>}
                  <Badge tone={l.stock > 0 ? "success" : "danger"}>{l.stock > 0 ? `${l.stock} in stock` : "Sold out"}</Badge>
                </div>
                {l.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{l.description}</p>}
                <div className="mt-auto flex items-end justify-between pt-5">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{formatNgn(l.priceNgn)}</p>
                    <p className="text-xs text-muted">per account</p>
                  </div>
                  <Button size="sm" disabled={l.stock === 0} onClick={() => setSelected(l)}>
                    Buy
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > 0 && (
          <Pagination page={page} pageCount={data.pageCount} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} side title="Buy accounts" description={selected?.category}>
        {selected && <PurchaseForm key={selected.slug} listing={selected} onDone={() => setSelected(null)} />}
      </Modal>
    </>
  );
}

function PurchaseForm({ listing, onDone }: { listing: AccountListing; onDone: () => void }) {
  const router = useRouter();
  const max = Math.min(listing.stock, 50);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState(false);
  const total = round2(listing.priceNgn * quantity);

  function submit() {
    startTransition(async () => {
      const res = await placeAccountOrder({ slug: listing.slug, quantity });
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
      <div className="py-6 text-center">
        <p className="text-lg font-semibold">Order saved</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">
          It&apos;s waiting for payment. Online payments aren&apos;t available yet, so nothing has been charged or delivered.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onDone}>
            Keep browsing
          </Button>
          <Link href="/dashboard/growth/orders" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-[#1a1a24]">
            View orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <p className="text-sm font-medium leading-6">{listing.title}</p>
        <p className="mt-1 text-xs text-muted">
          {formatNgn(listing.priceNgn)} each · {listing.stock} in stock
        </p>
      </div>
      {listing.description && <p className="text-sm leading-6 text-muted">{listing.description}</p>}
      <div>
        <label htmlFor="qty" className="mb-2 block text-sm font-medium">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" aria-label="Decrease" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
            −
          </Button>
          <input
            id="qty"
            type="number"
            min={1}
            max={max}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(max, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
            className="h-11 w-24 rounded-xl border border-border bg-background/60 text-center text-base outline-none focus:border-white/40"
          />
          <Button variant="outline" size="sm" aria-label="Increase" disabled={quantity >= max} onClick={() => setQuantity((q) => q + 1)}>
            +
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">Up to {max} per order.</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <span className="text-sm text-muted">Total</span>
        <span className="text-lg font-semibold tabular-nums">{formatNgn(total)}</span>
      </div>
      <Button size="lg" className="w-full" loading={pending} onClick={submit}>
        Place order
      </Button>
      <p className="text-center text-xs text-muted">You won&apos;t be charged yet. Login details are delivered after payment.</p>
    </div>
  );
}
