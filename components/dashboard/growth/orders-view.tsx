"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Rocket01Icon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { cancelOrder, revealCredentials } from "@/app/actions/growth";
import { LocalTime } from "@/components/dashboard/local-time";
import { OrderStatusBadge } from "@/components/dashboard/status-badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import type { OrderDTO } from "@/lib/data/types";
import { formatNgn } from "@/lib/pricing";
import { PaymentNotice } from "./payment-notice";

type Tab = "all" | "open" | "delivered" | "closed";

export function OrdersView({ orders, paymentsLive }: { orders: OrderDTO[]; paymentsLive: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<OrderDTO | null>(null);
  const [creds, setCreds] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const open = orders.filter((o) => ["pending_payment", "paid", "fulfilling"].includes(o.status));
  const delivered = orders.filter((o) => o.status === "delivered");
  const closed = orders.filter((o) => ["failed", "cancelled"].includes(o.status));
  const list = { all: orders, open, delivered, closed }[tab];

  function close() {
    setSelected(null);
    setCreds(null);
  }

  function cancel(o: OrderDTO) {
    startTransition(async () => {
      const res = await cancelOrder(o.id);
      if (res.ok) {
        toast.success("Order cancelled");
        close();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function reveal(o: OrderDTO) {
    startTransition(async () => {
      const res = await revealCredentials(o.id);
      if (res.ok) setCreds(res.accounts);
      else toast.error(res.error);
    });
  }

  return (
    <>
      {!paymentsLive && open.some((o) => o.status === "pending_payment") && <PaymentNotice />}

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart01Icon}
          title="No orders yet"
          description="Boost orders and account purchases will appear here with their status."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/dashboard/growth/boost" size="sm" icon={<HugeiconsIcon icon={Rocket01Icon} size={16} />}>
                Boost services
              </LinkButton>
              <LinkButton href="/dashboard/growth/accounts" size="sm" variant="outline">
                Buy accounts
              </LinkButton>
            </div>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 pt-3">
            <Tabs<Tab>
              className="-mb-px border-b-0"
              value={tab}
              onChange={setTab}
              items={[
                { value: "all", label: "All", count: orders.length },
                { value: "open", label: "Open", count: open.length },
                { value: "delivered", label: "Delivered", count: delivered.length },
                { value: "closed", label: "Failed / cancelled", count: closed.length },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted">No orders in this view.</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {list.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(o)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-white/5">
                      <HugeiconsIcon icon={o.kind === "smm" ? Rocket01Icon : ShoppingCart01Icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{o.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {o.kind === "smm" ? `${o.quantity.toLocaleString()} units` : `${o.quantity} account${o.quantity === 1 ? "" : "s"}`}
                        {" · "}
                        <LocalTime iso={o.createdAt} variant="ago" />
                      </span>
                    </span>
                    <span className="hidden text-sm font-medium tabular-nums sm:block">{formatNgn(o.totalNgn)}</span>
                    <OrderStatusBadge status={o.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={!!selected} onClose={close} side title="Order details" description={selected ? `#${selected.id.slice(-8).toUpperCase()}` : undefined}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-6">{selected.title}</p>
              <OrderStatusBadge status={selected.status} />
            </div>

            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              <Row label="Type" value={selected.kind === "smm" ? "Boost service" : "Account purchase"} />
              <Row label="Quantity" value={selected.quantity.toLocaleString()} />
              <Row label={selected.kind === "smm" ? "Price per 1,000" : "Price each"} value={formatNgn(selected.unitPriceNgn)} />
              <Row label="Total" value={formatNgn(selected.totalNgn)} bold />
              <Row label="Payment" value={<Badge tone={selected.paymentStatus === "paid" ? "success" : "warning"}>{selected.paymentStatus}</Badge>} />
              <Row label="Placed" value={<LocalTime iso={selected.createdAt} />} />
              {selected.link && (
                <Row
                  label="Link"
                  value={
                    <a href={selected.link} target="_blank" rel="noopener noreferrer" className="break-all underline">
                      {selected.link}
                    </a>
                  }
                />
              )}
              {selected.supplierStatus && <Row label="Progress" value={selected.supplierStatus} />}
            </dl>

            {selected.error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{selected.error}</p>
            )}

            {selected.kind === "account" && selected.status === "delivered" && (
              <div>
                {creds ? (
                  <div className="space-y-2">
                    {creds.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
                        <code className="min-w-0 flex-1 break-all text-xs">{c}</code>
                        <button
                          type="button"
                          aria-label="Copy"
                          className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-foreground"
                          onClick={async () => {
                            await navigator.clipboard.writeText(c);
                            toast.success("Copied");
                          }}
                        >
                          <HugeiconsIcon icon={Copy01Icon} size={15} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-muted">Change the passwords after you log in for the first time.</p>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" loading={pending} onClick={() => reveal(selected)}>
                    Reveal login details ({selected.deliveredCount})
                  </Button>
                )}
              </div>
            )}

            {selected.status === "pending_payment" && (
              <div className="space-y-3">
                <Button className="w-full" disabled title={paymentsLive ? undefined : "Online payments aren't available yet"}>
                  Pay now
                </Button>
                {!paymentsLive && <p className="text-center text-xs text-muted">Payments aren&apos;t available yet.</p>}
                <Button variant="ghost" className="w-full" loading={pending} onClick={() => cancel(selected)}>
                  Cancel order
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted">
              Questions about an order? <Link href="/dashboard/settings" className="underline">Contact support</Link>
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className={bold ? "font-semibold" : "text-right"}>{value}</dd>
    </div>
  );
}
