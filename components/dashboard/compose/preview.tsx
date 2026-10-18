"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar, PlatformIcon } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import type { AccountDTO } from "@/lib/data/types";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { ComposeMedia } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";

export function PostPreview({
  text,
  media,
  accounts,
  userName,
}: {
  text: string;
  media: ComposeMedia[];
  accounts: AccountDTO[];
  userName: string;
}) {
  const platforms = [...new Set(accounts.map((a) => a.platform))];
  const options: PlatformKey[] = platforms.length ? platforms : ["x"];
  const [picked, setPicked] = useState<PlatformKey>(options[0]);
  const active = options.includes(picked) ? picked : options[0];
  const meta = PLATFORMS[active];
  const account = accounts.find((a) => a.platform === active);
  const used = text.length;
  const over = used > meta.charLimit;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-3">
        <Tabs<PlatformKey>
          className="border-b-0"
          value={active}
          onChange={setPicked}
          items={options.map((p) => ({ value: p, label: PLATFORMS[p].name }))}
        />
      </div>
      <div className="border-t border-border p-5">
        <div className="flex items-center gap-3">
          <Avatar name={account?.displayName ?? userName} src={account?.avatar} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{account?.displayName ?? userName}</p>
            <p className="truncate text-xs text-muted">
              {account ? `@${account.handle}` : "Preview"} · now
            </p>
          </div>
          <PlatformIcon platform={active} size={18} />
        </div>

        <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-6">
          {text.trim() || <span className="text-muted">Your post will appear here as you type.</span>}
        </p>

        {media.length > 0 && (
          <div
            className={cn(
              "mt-4 grid gap-1.5 overflow-hidden rounded-xl",
              media.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {media.slice(0, 4).map((m) => (
              <div key={m.id} className="relative aspect-video bg-white/5">
                {m.resourceType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-muted">
                    <HugeiconsIcon icon={Video01Icon} size={28} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs">
        <span className="text-muted">{meta.name} limit</span>
        <span className={cn("tabular-nums", over ? "font-medium text-red-400" : "text-muted")}>
          {used.toLocaleString()} / {meta.charLimit.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
