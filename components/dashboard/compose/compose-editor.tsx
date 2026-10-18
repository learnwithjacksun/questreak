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
  Upload01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { savePost, type SaveMode } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/primitives";
import type { AccountDTO, MediaDTO } from "@/lib/data/types";
import { toLocalInputValue } from "@/lib/format";
import { PLATFORMS } from "@/lib/platforms";
import { CAPABILITIES, validateForPlatform } from "@/lib/publishing/capabilities";
import { optionProblems } from "@/lib/publishing/option-rules";
import { countFor } from "@/lib/publishing/text";
import { useComposeStore, type ComposeMedia } from "@/lib/stores/compose-store";
import { cn } from "@/lib/utils";
import type { PostOptions } from "@/models/post";
import { AiPanel } from "./ai-panel";
import { MediaPicker } from "./media-picker";
import { NetworkOptions } from "./network-options";
import { useMediaUpload } from "../use-media-upload";
import { PostPreview } from "./preview";

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
}: {
  accounts: AccountDTO[];
  library: MediaDTO[];
  initial: ComposeInitial;
  userName: string;
  tiktokAudited: boolean;
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
  const scheduleBlock = publishBlock ?? (!scheduledFor ? "Pick a date and time to schedule." : null);

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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section
          className={cn("card relative p-5 transition-colors", dragging && "border-foreground bg-white/[0.04]")}
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
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-background/80 text-sm font-medium">
              Drop to attach
            </div>
          )}
          <label htmlFor="post-text" className="text-sm font-medium">
            Post
          </label>
          <textarea
            id="post-text"
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
            className="mt-3 min-h-44 w-full resize-y rounded-xl border border-border bg-background/60 px-4 py-3 text-base leading-7 outline-none transition-colors placeholder:text-muted/60 focus:border-white/40"
          />

          {selectedPlatforms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
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
          )}

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
                <li key={m.id} className="group relative size-20 overflow-hidden rounded-lg border border-border bg-white/5">
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

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              loading={uploads.length > 0}
              icon={<HugeiconsIcon icon={Upload01Icon} size={16} />}
            >
              Upload from device
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              icon={<HugeiconsIcon icon={Image01Icon} size={16} />}
            >
              Choose from library
            </Button>
            <span className="text-xs text-muted">
              {media.length}/{MAX_MEDIA} attached · you can also drop or paste files
            </span>
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

        <section className="card p-5">
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
        </section>

        <NetworkOptions accounts={selected} text={text} hasVideo={hasVideo} tiktokAudited={tiktokAudited} />

        <section className="card p-5">
          <label htmlFor="schedule" className="text-sm font-medium">
            Schedule
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              id="schedule"
              type="datetime-local"
              value={scheduledFor}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-11 rounded-xl border border-border bg-background/60 px-3 text-base outline-none focus:border-white/40 [color-scheme:dark]"
            />
            {scheduledFor && (
              <Button size="sm" variant="ghost" onClick={() => setScheduledFor("")}>
                Clear
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Times use your device&apos;s time zone.</p>
        </section>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => submit("draft")}
              disabled={!hasContent || saving}
              loading={saving && pendingMode === "draft"}
            >
              Save draft
            </Button>
            <Button
              variant="outline"
              onClick={() => submit("schedule")}
              disabled={!!scheduleBlock || saving}
              loading={saving && pendingMode === "schedule"}
              title={scheduleBlock ?? undefined}
            >
              Schedule
            </Button>
            <Button
              onClick={() => submit("publish")}
              disabled={!!publishBlock || saving}
              loading={saving && pendingMode === "publish"}
              title={publishBlock ?? undefined}
            >
              Publish now
            </Button>
          </div>
          {problems.length > 1 ? (
            <ul className="space-y-1 text-xs text-red-400">
              {problems.slice(0, 5).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            (publishBlock || scheduleBlock) && <p className="text-xs text-muted">{publishBlock ?? scheduleBlock}</p>
          )}
          {selectedPlatforms.length > 0 && problems.length === 0 && (
            <ul className="space-y-0.5 text-xs text-muted">
              {selectedPlatforms.map((p) => (
                <li key={p}>
                  <span className="text-foreground/80">{PLATFORMS[p].name}:</span> {CAPABILITIES[p].hint}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
        <PostPreview text={text} media={media} accounts={selected} userName={userName} />
        <AiPanel selectedPlatforms={selectedPlatforms} />
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
