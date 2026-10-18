"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { disconnectAccount } from "@/app/actions/accounts";
import { Badge, Avatar, PlatformIcon } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AccountDTO } from "@/lib/data/types";
import { PLATFORM_LIST, type PlatformMeta } from "@/lib/platforms";
import { LocalTime } from "./local-time";

const statusTone = { active: "success", expired: "warning", error: "danger" } as const;
const statusLabel = { active: "Healthy", expired: "Reconnect needed", error: "Error" } as const;

export function AccountsGrid({ accounts }: { accounts: AccountDTO[] }) {
  const [target, setTarget] = useState<AccountDTO | null>(null);
  const [pending, startTransition] = useTransition();

  function connect(p: PlatformMeta) {
    toast.info(`Connecting ${p.name} isn't available yet`, {
      description: "We're finishing the official integration. You'll be able to connect it here soon.",
    });
  }

  function confirmDisconnect() {
    if (!target) return;
    startTransition(async () => {
      const res = await disconnectAccount(target.id);
      if (res.ok) toast.success(`${target.displayName} disconnected`);
      else toast.error(res.error);
      setTarget(null);
    });
  }

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {PLATFORM_LIST.map((p) => {
          const connected = accounts.filter((a) => a.platform === p.key);
          return (
            <section key={p.key} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <PlatformIcon platform={p.key} size={22} className="rounded-lg" />
                <div className="min-w-0 flex-1 basis-32">
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted">Connects a {p.accountKind}</p>
                </div>
                {!p.priority && <Badge>Planned</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => connect(p)}
                  icon={<HugeiconsIcon icon={Add01Icon} size={16} />}
                >
                  {connected.length ? "Add another" : "Connect"}
                </Button>
              </div>

              {connected.length > 0 ? (
                <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
                  {connected.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                      <Avatar name={a.displayName} src={a.avatar} size={36} />
                      <div className="min-w-0 flex-1 basis-36">
                        <p className="truncate text-sm font-medium">{a.displayName}</p>
                        <p className="truncate text-xs text-muted">
                          @{a.handle} · connected <LocalTime iso={a.connectedAt} variant="date" />
                        </p>
                      </div>
                      <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                        Disconnect
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted">
                  No {p.name} account connected.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2.5 text-sm text-muted">
        <HugeiconsIcon icon={ShieldKeyIcon} size={18} className="mt-0.5 shrink-0" />
        Questreak connects through each network&apos;s official sign-in. We never see or store your
        passwords, and you can revoke access any time.
      </p>

      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={confirmDisconnect}
        pending={pending}
        destructive
        title={`Disconnect ${target?.displayName ?? "account"}?`}
        description="Scheduled posts that target this account will move back to drafts. You can reconnect it later."
        confirmLabel="Disconnect"
      />
    </>
  );
}
