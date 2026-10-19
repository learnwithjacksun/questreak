"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  Image01Icon,
  Tick02Icon,
  ViewIcon,
  Upload01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { savePost, type SaveMode } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/primitives";
import type { AccountDTO, MediaDTO } from "@/lib/data/types";
import { PLATFORMS } from "@/lib/platforms";
import { CAPABILITIES, validateForPlatform } from "@/lib/publishing/capabilities";
import { optionProblems } from "@/lib/publishing/option-rules";
import { countFor } from "@/lib/publishing/text";
import { useComposeStore, type ComposeMedia } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";
import type { PostOptions } from "@/models/post";
import { AiToolbar } from "./ai-toolbar";
import { MediaPicker } from "./media-picker";
import { NetworkOptions } from "./network-options";
import { useMediaUpload } from "../use-media-upload";
import { PostPreview } from "./preview";
import { PreviewPanel, usePreviewPanel } from "./preview-panel";
import { SchedulePopover } from "./schedule-popover";

export type ComposeInitial = {
  postId: string | null;
  text: string;
  accountIds: string[];
  media: ComposeMedia[];
  scheduledFor: string;
  options: PostOptions;
};

export function ComposeEditor({
  accounts,
  library,
  initial,
  userName,
  tiktokAudited,
  title,
}: {
  accounts: AccountDTO[];
  library: MediaDTO[];
  initial: ComposeInitial;
  userName: string;
  tiktokAudited: boolean;
  title: string;
}) {
  // Seed the store once, before the first read, so a stale draft never flashes.
  useState(() => {
    useComposeStore.getState().init(initial);
    return null;
  });

  const router = useRouter();
  const { postId, text, accountIds, media, scheduledFor, options, setText, toggleAccount, setMedia, removeMedia, setScheduledFor } =
    useComposeStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<SaveMode | null>(null);
  const [saving, startTransition] = useTransition();
  const { uploads, upload } = useMediaUpload();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const MAX_MEDIA = 10;
  const preview = usePreviewPanel();

  /** Uploads files from the device and attaches them to the post (also saved to the library). */
  async function attachFromDevice(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const room = MAX_MEDIA - useComposeStore.getState().media.length - uploads.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_MEDIA} files.`);
      return;
    }
    if (incoming.length > room) toast.info(`Only ${room} more file${room === 1 ? "" : "s"} can be attached.`);
    const added = await upload(incoming.slice(0, room));
    if (!added.length) return;
    const store = useComposeStore.getState();
    store.setMedia([
      ...store.media,
      ...added.map((m) => ({ id: m.id, url: m.url, resourceType: m.resourceType })),
    ]);
    // Refresh so the library picker also lists the new files.
    router.refresh();
  }

  const selected = accounts.filter((a) => accountIds.includes(a.id));
  const selectedPlatforms = [...new Set(selected.map((a) => a.platform))];
  const hasAccounts = accounts.length > 0;
  const hasContent = text.trim().length > 0 || media.length > 0;
  const hasVideo = media.some((m) => m.resourceType === "video");
  const needReconnect = selected.filter((a) => a.status !== "active");

  /** Tightest text limit among the selected accounts of a network (Mastodon servers differ). */
  const limitFor = (platform: (typeof selectedPlatforms)[number]) =>
    Math.min(...selected.filter((a) => a.platform === platform).map((a) => a.charLimit ?? PLATFORMS[platform].charLimit));

  // Everything that would make a network reject this post, so the user fixes it before sending.
  const problems = hasContent
    ? [
        ...new Set([
          ...selected.flatMap((a) => validateForPlatform(a.platform, text, media, a.charLimit ?? undefined)),
          ...optionProblems(selected, options),
        ]),
      ]
    : [];

  const publishBlock = !hasAccounts
    ? "Connect an account to publish or schedule."
    : selected.length === 0
      ? "Select at least one account."
      : needReconnect.length > 0
        ? `Reconnect ${needReconnect.map((a) => a.displayName).join(", ")} first.`
        : !hasContent
          ? "Add some text or media."
          : (problems[0] ?? null);

  function submit(mode: SaveMode) {
    setPendingMode(mode);
    startTransition(async () => {
      const res = await savePost(
        {
          id: postId ?? undefined,
          text,
          accountIds,
          mediaIds: media.map((m) => m.id),
          scheduledFor: mode === "schedule" && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          options,
        },
        mode,
      );
      setPendingMode(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      useComposeStore.getState().init({});

      if (mode === "publish" && res.outcome) {
        const sent = res.outcome.results.filter((r) => r.ok).length;
        const total = res.outcome.results.length;
        const failed = res.outcome.results.filter((r) => !r.ok);
        if (res.outcome.ok) {
          const note = res.outcome.results.find((r) => r.note)?.note;
          toast.success(total === 1 ? "Post published" : `Published to ${total} accounts`, note ? { description: note } : undefined);
          router.push("/dashboard/posts?status=published");
        } else {
          toast.error(sent > 0 ? `Published to ${sent} of ${total} accounts` : "Couldn't publish this post", {
            description: failed.map((f) => `${PLATFORMS[f.platform].name}: ${f.error}`).join("\n"),
            duration: 12_000,
          });
          router.push("/dashboard/posts?status=failed");
        }
        return;
      }
      toast.success(mode === "schedule" ? "Post scheduled" : "Draft saved");
      router.push(`/dashboard/posts?status=${mode === "schedule" ? "scheduled" : "draft"}`);
    });
  }

  const needsOptions = selected.some((a) => a.platform === "youtube" || a.platform === "pinterest" || a.platform === "tiktok");

  return (
    <div>
      <h1 className="pb-4 text-3xl font-semibold tracking-tight sm:hidden">{title}</h1>
      {/* Action bar: the three outcomes live here, always in reach. */}
      <div className="sticky top-16 z-30 -mx-5 border-b border-border bg-background/80 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="hidden min-w-0 truncate text-xl font-semibold tracking-tight sm:block sm:text-2xl">{title}</h1>
          <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-2">
            <button
              type="button"
              onClick={preview.toggle}
              aria-pressed={preview.open}
              aria-label={preview.open ? "Hide preview" : "Show preview"}
              title={preview.open ? "Hide preview" : "Show preview"}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors sm:size-11",
                preview.open ? "border-foreground bg-white/10" : "border-border text-muted hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={ViewIcon} size={18} />
            </button>
            <Button
              variant="ghost"
              className="h-9! px-3! sm:h-11! sm:px-5!"
              onClick={() => submit("draft")}
              disabled={!hasContent || saving}
              loading={saving && pendingMode === "draft"}
            >
              <span className="sm:hidden">Draft</span>
              <span className="hidden sm:inline">Save draft</span>
            </Button>
            <SchedulePopover
              value={scheduledFor}
              onChange={setScheduledFor}
              onConfirm={() => submit("schedule")}
              disabled={!!publishBlock || saving}
              blockReason={publishBlock}
              loading={saving && pendingMode === "schedule"}
            />
            <Button
              className="h-9! px-4! sm:h-11! sm:px-5!"
              onClick={() => submit("publish")}
              disabled={!!publishBlock || saving}
              loading={saving && pendingMode === "publish"}
              title={publishBlock ?? undefined}
            >
              Publish<span className="hidden sm:inline">&nbsp;now</span>
            </Button>
          </div>
        </div>
        {problems.length > 1 ? (
          <ul className="mt-2 space-y-1 text-xs text-red-400">
            {problems.slice(0, 5).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          publishBlock && hasContent && <p className="mt-2 text-xs text-muted">{publishBlock}</p>
        )}
      </div>

      <div className="flex pt-6">
        <div className="min-w-0 flex-1 space-y-6">
          <section
            className="relative"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              setDragging(false);
              void attachFromDevice(e.dataTransfer.files);
            }}
          >
            {dragging && (
              <div className="pointer-events-none absolute -inset-2 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-foreground/50 bg-background/80 text-sm font-medium">
                Drop to attach
              </div>
            )}
            <label htmlFor="post-text" className="sr-only">
              Post
            </label>
            <textarea
              id="post-text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files).filter((f) => /^(image|video)\//.test(f.type));
                if (files.length) {
                  e.preventDefault();
                  void attachFromDevice(files);
                }
              }}
              placeholder="What do you want to share?"
              className="block min-h-[45vh] w-full resize-none bg-transparent text-lg leading-8 outline-none placeholder:text-muted/50 sm:text-xl sm:leading-9"
            />

            {uploads.length > 0 && (
              <ul className="mt-4 space-y-2" aria-live="polite">
                {uploads.map((u) => (
                  <li key={u.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{u.name}</span>
                      <span className="tabular-nums text-muted">{u.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-foreground transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {media.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2.5">
                {media.map((m) => (
                  <li key={m.id} className="group relative size-24 overflow-hidden rounded-xl border border-border bg-white/5">
                    {m.resourceType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted">
                        <HugeiconsIcon icon={Video01Icon} size={22} />
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Remove media"
                      onClick={() => removeMedia(m.id)}
                      className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                loading={uploads.length > 0}
                icon={<HugeiconsIcon icon={Upload01Icon} size={16} />}
              >
                Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPickerOpen(true)}
                icon={<HugeiconsIcon icon={Image01Icon} size={16} />}
              >
                Library
              </Button>
              <span className="text-xs text-muted">
                {media.length}/{MAX_MEDIA}
                <span className="hidden sm:inline"> · drop or paste files too</span>
              </span>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                {selectedPlatforms.map((p) => {
                  const limit = limitFor(p);
                  const len = countFor(p, text);
                  const over = len > limit;
                  return (
                    <span
                      key={p}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tabular-nums",
                        over ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border text-muted",
                      )}
                    >
                      {PLATFORMS[p].name} {len.toLocaleString()}/{limit.toLocaleString()}
                    </span>
                  );
                })}
              </div>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/*,video/*"
                className="sr-only"
                aria-label="Upload images or videos from your device"
                onChange={(e) => {
                  if (e.target.files) void attachFromDevice(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </section>

          <AiToolbar selectedPlatforms={selectedPlatforms} />

          <section className="border-t border-border pt-6">
            <h2 className="text-sm font-medium">Post to</h2>
            {hasAccounts ? (
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {accounts.map((a) => {
                  const on = accountIds.includes(a.id);
                  const stale = a.status !== "active";
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAccount(a.id)}
                        title={stale ? "This account needs to be reconnected before it can post" : PLATFORMS[a.platform].name}
                        className={cn(
                          "flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-sm transition-colors",
                          on ? "border-foreground bg-white/10" : "border-border text-muted hover:text-foreground",
                          stale && "border-amber-500/40",
                        )}
                      >
                        <PlatformIcon platform={a.platform} size={16} className="rounded-full" />
                        {a.displayName}
                        {stale && <span className="text-xs text-amber-400">Reconnect</span>}
                        {on && <HugeiconsIcon icon={Tick02Icon} size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-sm">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-muted">
                  No accounts connected yet. You can save drafts now;{" "}
                  <Link href="/dashboard/accounts" className="text-foreground underline">
                    connect an account
                  </Link>{" "}
                  to schedule or publish.
                </p>
              </div>
            )}
            {selectedPlatforms.length > 0 && problems.length === 0 && (
              <ul className="mt-3 space-y-0.5 text-xs text-muted">
                {selectedPlatforms.map((p) => (
                  <li key={p}>
                    <span className="text-foreground/80">{PLATFORMS[p].name}:</span> {CAPABILITIES[p].hint}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {needsOptions && (
            <details open>
              <summary className="cursor-pointer text-sm font-medium text-muted transition-colors hover:text-foreground">
                Options for selected networks
              </summary>
              <div className="mt-3">
                <NetworkOptions accounts={selected} text={text} hasVideo={hasVideo} tiktokAudited={tiktokAudited} />
              </div>
            </details>
          )}
        </div>

        <PreviewPanel open={preview.open} desktop={preview.desktop} onClose={preview.close}>
          <PostPreview text={text} media={media} accounts={selected} userName={userName} />
        </PreviewPanel>
      </div>

      <MediaPicker
        key={String(pickerOpen)}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        library={library}
        selected={media}
        onConfirm={setMedia}
      />
    </div>
  );
}
