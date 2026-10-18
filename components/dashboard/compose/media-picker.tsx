"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { MediaDTO } from "@/lib/data/types";
import type { ComposeMedia } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";

export function MediaPicker({
  open,
  onClose,
  library,
  selected,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  library: MediaDTO[];
  selected: ComposeMedia[];
  onConfirm: (media: ComposeMedia[]) => void;
}) {
  const [ids, setIds] = useState<string[]>(selected.map((m) => m.id));

  function toggle(id: string) {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 10 ? [...cur, id] : cur));
  }

  return (
    <Modal open={open} onClose={onClose} title="Attach media" description="Choose up to 10 files from your library." className="max-w-2xl">
      {library.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted">Your media library is empty.</p>
          <p className="mt-1 text-sm text-muted">Use &ldquo;Upload from device&rdquo; to add a file straight to this post.</p>
          <Link href="/dashboard/media" className="mt-3 inline-block text-sm underline">
            Manage your media library
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {library.map((m) => {
            const on = ids.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className={cn(
                    "relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-white/5",
                    on ? "border-foreground" : "border-transparent",
                  )}
                >
                  {m.resourceType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.name} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-muted">
                      <HugeiconsIcon icon={Video01Icon} size={26} />
                    </span>
                  )}
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background">
                      <HugeiconsIcon icon={Tick02Icon} size={12} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-muted">{ids.length} selected</span>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const byId = new Map(library.map((m) => [m.id, m]));
              onConfirm(
                ids
                  .map((id) => byId.get(id))
                  .filter((m): m is MediaDTO => !!m)
                  .map((m) => ({ id: m.id, url: m.url, resourceType: m.resourceType })),
              );
              onClose();
            }}
          >
            Attach
          </Button>
        </div>
      </div>
    </Modal>
  );
}
