"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Delete02Icon,
  Image01Icon,
  Search01Icon,
  Upload01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { deleteMedia } from "@/app/actions/media";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import type { MediaDTO } from "@/lib/data/types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LocalTime } from "./local-time";
import { useMediaUpload } from "./use-media-upload";

type Filter = "all" | "image" | "video";

export function MediaLibrary({ items }: { items: MediaDTO[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { uploads, upload } = useMediaUpload();
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<MediaDTO | null>(null);
  const [deleting, setDeleting] = useState<MediaDTO | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = items.filter(
    (m) => (filter === "all" || m.resourceType === filter) && m.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function handleFiles(files: FileList | File[]) {
    const added = await upload(files);
    if (added.length) router.refresh();
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteMedia(deleting.id);
      if (res.ok) {
        toast.success("File deleted");
        router.refresh();
      } else toast.error(res.error);
      setDeleting(null);
      setPreview(null);
    });
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
          drag ? "border-foreground bg-white/5" : "border-border",
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl border border-border bg-white/5">
          <HugeiconsIcon icon={Upload01Icon} size={20} />
        </span>
        <p className="mt-4 font-medium">Drag and drop files here</p>
        <p className="mt-1 text-sm text-muted">Images and videos up to 100 MB each</p>
        <Button className="mt-5" variant="outline" size="sm" onClick={() => input.current?.click()}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,video/*"
          className="sr-only"
          aria-label="Upload files"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-4 space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="card px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="truncate">{u.name}</span>
                <span className="tabular-nums text-muted">{u.progress}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-foreground transition-all" style={{ width: `${u.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter>
          className="border-b-0"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "All", count: items.length },
            { value: "image", label: "Images", count: items.filter((m) => m.resourceType === "image").length },
            { value: "video", label: "Videos", count: items.filter((m) => m.resourceType === "video").length },
          ]}
        />
        <div className="relative sm:w-64">
          <HugeiconsIcon icon={Search01Icon} size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files"
            aria-label="Search files"
            className="h-11 w-full rounded-xl border border-border bg-background/60 pl-10 pr-3 text-base outline-none focus:border-white/40"
          />
        </div>
      </div>

      <div className="mt-5">
        {shown.length === 0 ? (
          <EmptyState
            icon={Image01Icon}
            title={items.length === 0 ? "No media yet" : "No matching files"}
            description={
              items.length === 0
                ? "Upload images and videos once, then attach them to any post."
                : "Try a different search or filter."
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setPreview(m)}
                  className="card group block w-full overflow-hidden text-left transition-colors hover:border-white/20"
                >
                  <span className="relative block aspect-square bg-white/5">
                    {m.resourceType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted">
                        <HugeiconsIcon icon={Video01Icon} size={30} />
                      </span>
                    )}
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-sm">{m.name}</span>
                    <span className="block text-xs text-muted">{formatBytes(m.bytes)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "File"} className="max-w-2xl">
        {preview && (
          <>
            <div className="overflow-hidden rounded-xl bg-black/40">
              {preview.resourceType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="mx-auto max-h-[60vh] object-contain" />
              ) : (
                <video src={preview.url} controls className="mx-auto max-h-[60vh]" />
              )}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted">Size</dt>
                <dd>{formatBytes(preview.bytes)}</dd>
              </div>
              <div>
                <dt className="text-muted">Dimensions</dt>
                <dd>{preview.width && preview.height ? `${preview.width}×${preview.height}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Uploaded</dt>
                <dd>
                  <LocalTime iso={preview.createdAt} variant="date" />
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-between gap-3">
              <Button
                variant="outline"
                icon={<HugeiconsIcon icon={Copy01Icon} size={16} />}
                onClick={async () => {
                  await navigator.clipboard.writeText(preview.url);
                  toast.success("Link copied");
                }}
              >
                Copy link
              </Button>
              <Button variant="danger" icon={<HugeiconsIcon icon={Delete02Icon} size={16} />} onClick={() => setDeleting(preview)}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={pending}
        destructive
        title="Delete this file?"
        description="It will be removed from your library. Posts that already use it keep their own copy of the link, which will stop working."
        confirmLabel="Delete"
      />
    </>
  );
}
