"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Calendar03Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  File02Icon,
  MoreHorizontalIcon,
  RefreshIcon,
  Search01Icon,
  SentIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { deletePost, duplicatePost, publishNow, reschedulePost, unschedulePost } from "@/app/actions/posts";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Popover, menuItemClass } from "@/components/ui/popover";
import { EmptyState, PlatformIcon, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import type { PostDTO } from "@/lib/data/types";
import { toLocalInputValue } from "@/lib/format";
import { PLATFORM_LIST, PLATFORMS } from "@/lib/platforms";
import { PostRow } from "./post-row";

type Status = "all" | "published" | "scheduled" | "draft" | "failed";
type Response = {
  items: PostDTO[];
  total: number;
  pageCount: number;
  counts: Record<Status, number>;
};

const PAGE_SIZE = 10;
const empty: Record<Status, { title: string; text: string }> = {
  all: { title: "No posts yet", text: "Your drafts, scheduled and published posts will all live here." },
  published: { title: "Nothing published yet", text: "Published posts and their delivery status appear here." },
  scheduled: { title: "No scheduled posts", text: "Schedule a post from the composer and it will wait here." },
  draft: { title: "No drafts", text: "Save a post as a draft to finish it later." },
  failed: { title: "No failed posts", text: "If a delivery fails, you'll see it here with the reason." },
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PostsView({ initialStatus }: { initialStatus: Status }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const [deleting, setDeleting] = useState<PostDTO | null>(null);
  const [publishing, setPublishing] = useState<PostDTO | null>(null);
  const [rescheduling, setRescheduling] = useState<PostDTO | null>(null);
  const [when, setWhen] = useState("");
  const [pending, startTransition] = useTransition();

  const { data, isLoading, isError, isPlaceholderData, refetch } = useQuery<Response>({
    queryKey: ["posts", { status, platform, q, sort, page }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ status, platform, q, sort, page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/posts?${params}`, { signal });
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, done?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(success);
        await qc.invalidateQueries({ queryKey: ["posts"] });
      } else toast.error(res.error ?? "Something went wrong.");
      done?.();
    });
  }

  /** Sends a post now (or retries only its failed accounts) and reports per-network results. */
  function sendNow(p: PostDTO, done?: () => void) {
    startTransition(async () => {
      const res = await publishNow(p.id);
      if (!res.ok) {
        toast.error(res.error);
      } else if (res.outcome.ok) {
        toast.success("Published");
      } else {
        const failed = res.outcome.results.filter((r) => !r.ok);
        toast.error(`${failed.length} account${failed.length === 1 ? "" : "s"} failed`, {
          description: failed.map((f) => `${PLATFORMS[f.platform].name}: ${f.error}`).join("\n"),
          duration: 12_000,
        });
      }
      await qc.invalidateQueries({ queryKey: ["posts"] });
      done?.();
    });
  }

  const counts = data?.counts;
  const tabs = [
    { value: "all" as const, label: "All", count: counts?.all },
    { value: "published" as const, label: "Published", count: counts?.published },
    { value: "scheduled" as const, label: "Scheduled", count: counts?.scheduled },
    { value: "draft" as const, label: "Drafts", count: counts?.draft },
    { value: "failed" as const, label: "Failed", count: counts?.failed },
  ];

  const filtered = q !== "" || platform !== "all";

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-5 pt-3">
          <Tabs<Status> items={tabs} value={status} onChange={reset(setStatus)} className="-mb-px border-b-0" />
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <HugeiconsIcon icon={Search01Icon} size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="Search posts"
              aria-label="Search posts"
              className="h-11 w-full rounded-xl border border-border bg-background/60 pl-10 pr-3 text-base outline-none focus:border-white/40"
            />
          </div>
          <Select
            className="sm:w-48"
            ariaLabel="Filter by network"
            value={platform}
            onChange={reset(setPlatform)}
            options={[
              { value: "all", label: "All networks" },
              ...PLATFORM_LIST.map((p) => ({
                value: p.key as string,
                label: p.name,
                icon: <PlatformIcon platform={p.key} size={12} />,
              })),
            ]}
          />
          <Select<"newest" | "oldest">
            className="sm:w-40"
            ariaLabel="Sort"
            value={sort}
            onChange={reset(setSort)}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
            ]}
          />
        </div>

        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {isLoading ? (
            <div className="space-y-px border-t border-border">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-4 px-5 py-4">
                  <Skeleton className="size-9" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="border-t border-border p-6">
              <EmptyState
                className="border-0"
                icon={File02Icon}
                title="Couldn't load posts"
                description="Check your connection and try again."
                action={<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>}
              />
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="border-t border-border p-6">
              <EmptyState
                className="border-0"
                icon={File02Icon}
                title={filtered ? "No matching posts" : empty[status].title}
                description={filtered ? "Try a different search or network." : empty[status].text}
                action={
                  filtered ? undefined : (
                    <LinkButton href="/dashboard/compose" size="sm" icon={<HugeiconsIcon icon={Add01Icon} size={16} />}>
                      New post
                    </LinkButton>
                  )
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {data?.items.map((p) => (
                <li key={p.id}>
                  <PostRow
                    post={p}
                    actions={
                      <Popover
                        align="right"
                        panelClassName="w-52"
                        trigger={(props) => (
                          <button
                            type="button"
                            aria-label="Post actions"
                            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                            {...props}
                          >
                            <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            {p.status !== "published" && (
                              <Link href={`/dashboard/compose?edit=${p.id}`} role="menuitem" className={menuItemClass} onClick={close}>
                                <HugeiconsIcon icon={Edit02Icon} size={16} className="text-muted" /> Edit
                              </Link>
                            )}
                            {p.status !== "published" && p.targets.length > 0 && (
                              <button
                                type="button"
                                role="menuitem"
                                className={menuItemClass}
                                onClick={() => {
                                  close();
                                  setPublishing(p);
                                }}
                              >
                                <HugeiconsIcon icon={p.status === "failed" ? RefreshIcon : SentIcon} size={16} className="text-muted" />
                                {p.status === "failed" ? "Retry failed" : "Publish now"}
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className={menuItemClass}
                              onClick={() => {
                                close();
                                run(() => duplicatePost(p.id), "Duplicated as a draft");
                              }}
                            >
                              <HugeiconsIcon icon={Copy01Icon} size={16} className="text-muted" /> Duplicate
                            </button>
                            {p.status === "scheduled" && (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={menuItemClass}
                                  onClick={() => {
                                    close();
                                    setWhen(toLocalInputValue(new Date(p.scheduledFor!)));
                                    setRescheduling(p);
                                  }}
                                >
                                  <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-muted" /> Reschedule
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={menuItemClass}
                                  onClick={() => {
                                    close();
                                    run(() => unschedulePost(p.id), "Moved to drafts");
                                  }}
                                >
                                  <HugeiconsIcon icon={Undo02Icon} size={16} className="text-muted" /> Move to drafts
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className={`${menuItemClass} text-red-400`}
                              onClick={() => {
                                close();
                                setDeleting(p);
                              }}
                            >
                              <HugeiconsIcon icon={Delete02Icon} size={16} /> Delete
                            </button>
                          </>
                        )}
                      </Popover>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data && data.total > 0 && (
        <Pagination page={page} pageCount={data.pageCount} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />
      )}

      <ConfirmDialog
        open={!!publishing}
        onClose={() => setPublishing(null)}
        pending={pending}
        title={publishing?.status === "failed" ? "Retry the failed accounts?" : "Publish this post now?"}
        description={
          publishing?.status === "failed"
            ? "Only the accounts that failed will be tried again. Accounts that already published won't get a duplicate."
            : "It will be sent to every selected account right away."
        }
        confirmLabel={publishing?.status === "failed" ? "Retry" : "Publish now"}
        onConfirm={() => publishing && sendNow(publishing, () => setPublishing(null))}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        pending={pending}
        destructive
        title="Delete this post?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && run(() => deletePost(deleting.id), "Post deleted", () => setDeleting(null))}
      />

      <Modal open={!!rescheduling} onClose={() => setRescheduling(null)} title="Reschedule post">
        <label htmlFor="resched" className="text-sm font-medium">
          New date and time
        </label>
        <input
          id="resched"
          type="datetime-local"
          value={when}
          min={toLocalInputValue(new Date())}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-base outline-none focus:border-white/40 [color-scheme:dark]"
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRescheduling(null)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={!when}
            onClick={() =>
              rescheduling &&
              run(
                () => reschedulePost(rescheduling.id, new Date(when).toISOString()),
                "Post rescheduled",
                () => setRescheduling(null),
              )
            }
          >
            Save
          </Button>
        </div>
      </Modal>
    </>
  );
}
