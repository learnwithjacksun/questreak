"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { disconnectAccount } from "@/app/actions/accounts";
import { connectBlueskyAccount, getPinterestBoards, setPinterestBoard } from "@/app/actions/connections";
import { Field, PasswordField } from "@/components/auth/form-parts";
import { Avatar, Badge, PlatformIcon } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { AccountDTO } from "@/lib/data/types";
import { PLATFORM_LIST, PLATFORMS, type PlatformKey, type PlatformMeta } from "@/lib/platforms";
import { hardNavigate } from "@/lib/client/navigate";
import { displayHandle } from "@/lib/format";
import type { ConnectMethod } from "@/lib/publishing/registry";
import { LocalTime } from "./local-time";

export type PlatformStatus = { configured: boolean; missing: string[]; method: ConnectMethod };
export type Flash = { connected?: string; count?: string; error?: string; platform?: string; detail?: string };

const statusTone = { active: "success", expired: "warning", error: "danger" } as const;
const statusLabel = { active: "Healthy", expired: "Reconnect needed", error: "Error" } as const;

const PLATFORM_NAME = (k?: string) => (k && k in PLATFORMS ? PLATFORMS[k as PlatformKey].name : "the network");

/** Mastodon accounts remember their server in the handle ("@me@mastodon.social"). */
const instanceOf = (a: AccountDTO) => a.handle.split("@").pop() ?? "";

export function AccountsGrid({
  accounts,
  statuses,
  flash,
}: {
  accounts: AccountDTO[];
  statuses: Record<PlatformKey, PlatformStatus>;
  flash: Flash;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<AccountDTO | null>(null);
  const [pending, startTransition] = useTransition();
  const [bluesky, setBluesky] = useState(false);
  const [mastodon, setMastodon] = useState<string | null>(null); // prefilled instance
  const [mastodonOpen, setMastodonOpen] = useState(false);

  // Show the result of a connect redirect once, then clean the URL.
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || (!flash.connected && !flash.error)) return;
    shown.current = true;
    const name = PLATFORM_NAME(flash.platform ?? flash.connected);
    if (flash.connected) {
      const n = Number(flash.count ?? 1);
      toast.success(n > 1 ? `${name}: ${n} accounts connected` : `${name} connected`);
    } else if (flash.error === "denied") {
      toast.info(`${name} connection cancelled`);
    } else if (flash.error === "not_configured") {
      toast.error(`${name} isn't set up on this server yet.`);
    } else if (flash.error === "invalid_state") {
      toast.error("That sign-in link expired. Please try connecting again.");
    } else {
      toast.error(flash.detail || `Couldn't connect ${name}.`);
    }
    router.replace("/dashboard/accounts");
  }, [flash, router]);

  function connect(p: PlatformMeta, reconnectOf?: AccountDTO) {
    const st = statuses[p.key];
    if (!st.configured) {
      toast.error(`${p.name} isn't set up on this server yet.`, {
        description: st.missing.length ? `Add ${st.missing.join(", ")} to the server settings.` : undefined,
      });
      return;
    }
    if (st.method === "credentials") setBluesky(true);
    else if (st.method === "instance") {
      setMastodon(reconnectOf ? instanceOf(reconnectOf) : null);
      setMastodonOpen(true);
    } else hardNavigate(`/api/connect/${p.key}`);
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
          const st = statuses[p.key];
          return (
            <section key={p.key} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <PlatformIcon platform={p.key} size={22} className="rounded-lg" />
                <div className="min-w-0 flex-1 basis-32">
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-muted">
                    {p.key === "instagram" ? "Connects through Facebook (Business account)" : `Connects a ${p.accountKind}`}
                  </p>
                </div>
                {!st.configured && <Badge tone="warning">Setup needed</Badge>}
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
                    <li key={a.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <Avatar name={a.displayName} src={a.avatar} size={36} />
                        <div className="min-w-0 flex-1 basis-36">
                          <p className="truncate text-sm font-medium">{a.displayName}</p>
                          <p className="truncate text-xs text-muted">
                            {displayHandle(a.platform, a.handle)} · connected <LocalTime iso={a.connectedAt} variant="date" />
                          </p>
                        </div>
                        <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                        {a.status !== "active" && (
                          <Button size="sm" variant="outline" onClick={() => connect(p, a)}>
                            Reconnect
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                          Disconnect
                        </Button>
                      </div>
                      {a.status !== "active" && a.lastError && (
                        <p className="mt-2 text-xs leading-5 text-amber-400">{a.lastError}</p>
                      )}
                      {a.platform === "pinterest" && a.status === "active" && <PinterestBoard account={a} />}
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
        Questreak connects through each network&apos;s official sign-in. Bluesky uses an app password,
        which is stored encrypted and can be revoked in Bluesky at any time.
      </p>

      <BlueskyDialog open={bluesky} onClose={() => setBluesky(false)} onDone={() => router.refresh()} />
      <MastodonDialog open={mastodonOpen} initial={mastodon} onClose={() => setMastodonOpen(false)} />

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

function BlueskyDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await connectBlueskyAccount({ identifier, appPassword: password, pds: advanced ? server : undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${res.handle} connected`);
      setPassword("");
      onClose();
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Bluesky" description="Use an app password, never your main password.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Handle"
          placeholder="you.bsky.social"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <PasswordField
          label="App password"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <p className="text-xs leading-5 text-muted">
          Create one in Bluesky under{" "}
          <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer" className="underline">
            Settings → Privacy and security → App passwords
          </a>
          . You can revoke it there at any time.
        </p>
        {advanced ? (
          <Field label="Server (optional)" placeholder="https://bsky.social" value={server} onChange={(e) => setServer(e.target.value)} />
        ) : (
          <button type="button" onClick={() => setAdvanced(true)} className="text-xs text-muted underline">
            I host my own Bluesky server
          </button>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!identifier.trim() || !password.trim()}>
            Connect
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MastodonDialog({ open, initial, onClose }: { open: boolean; initial: string | null; onClose: () => void }) {
  const [server, setServer] = useState("");
  const value = server || initial || "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    hardNavigate(`/api/connect/mastodon?instance=${encodeURIComponent(value.trim())}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Mastodon" description="Enter the server your account is on.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Server"
          placeholder="mastodon.social"
          autoComplete="off"
          inputMode="url"
          value={value}
          onChange={(e) => setServer(e.target.value)}
        />
        <p className="text-xs leading-5 text-muted">
          It&apos;s the part after the second @ in your handle (for @me@mastodon.social that&apos;s mastodon.social).
          You&apos;ll be sent there to approve access.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!value.trim()}>
            Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PinterestBoard({ account }: { account: AccountDTO }) {
  const [selected, setSelected] = useState<string | undefined>(account.boardId ?? undefined);
  const { data, isLoading } = useQuery({
    queryKey: ["pinterest-boards", account.id],
    queryFn: () => getPinterestBoards(account.id),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <p className="mt-3 text-xs text-muted">Loading boards…</p>;
  if (!data?.ok) return <p className="mt-3 text-xs text-amber-400">{data?.error ?? "Couldn't load your boards."}</p>;
  if (data.boards.length === 0) return <p className="mt-3 text-xs text-muted">This account has no boards yet. Create one on Pinterest.</p>;

  return (
    <div className="mt-3 max-w-sm">
      <Select
        label="Default board for new pins"
        value={selected ?? data.boards[0].id}
        options={data.boards.map((b) => ({ value: b.id, label: b.name }))}
        onChange={async (id) => {
          setSelected(id);
          const res = await setPinterestBoard(account.id, id);
          if (res.ok) toast.success("Default board saved");
          else toast.error(res.error);
        }}
      />
    </div>
  );
}
