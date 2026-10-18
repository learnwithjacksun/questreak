import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Image01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { PlatformIcon } from "@/components/ui/primitives";
import type { PostDTO } from "@/lib/data/types";
import { PLATFORMS } from "@/lib/platforms";
import { LocalTime } from "./local-time";
import { PostStatusBadge } from "./status-badge";

/** One post in a list: platforms, text preview, media count, status and time. */
export function PostRow({ post, actions }: { post: PostDTO; actions?: ReactNode }) {
  const when =
    post.status === "scheduled" && post.scheduledFor
      ? post.scheduledFor
      : (post.publishedAt ?? post.updatedAt);
  const failed = post.targets.filter((t) => t.status === "failed");
  const live = post.targets.filter((t) => t.status === "published" && t.externalUrl);
  const images = post.media.filter((m) => m.resourceType === "image").length;
  const videos = post.media.length - images;

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="flex w-10 shrink-0 flex-col gap-1">
        {post.platforms.length > 0 ? (
          post.platforms.slice(0, 3).map((p) => <PlatformIcon key={p} platform={p} size={16} />)
        ) : (
          <span className="grid size-7 place-items-center rounded-md bg-white/5 text-[10px] text-muted">
            —
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-6">
          {post.text.trim() || <span className="text-muted">No text, media only</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <PostStatusBadge status={post.status} />
          <LocalTime iso={when} variant={post.status === "scheduled" ? "datetime" : "ago"} />
          {images > 0 && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Image01Icon} size={13} />
              {images}
            </span>
          )}
          {videos > 0 && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Video01Icon} size={13} />
              {videos}
            </span>
          )}
          {post.platforms.length > 3 && <span>+{post.platforms.length - 3} networks</span>}
        </div>

        {failed.length > 0 && (
          <ul className="mt-2.5 space-y-1 text-xs leading-5 text-red-400">
            {failed.slice(0, 3).map((t) => (
              <li key={t.accountId}>
                <span className="font-medium">{PLATFORMS[t.platform].name}:</span> {t.error ?? "Couldn't publish."}
                {t.needsReconnect && (
                  <>
                    {" "}
                    <Link href="/dashboard/accounts" className="underline">
                      Reconnect
                    </Link>
                  </>
                )}
              </li>
            ))}
            {failed.length > 3 && <li className="text-muted">+{failed.length - 3} more</li>}
          </ul>
        )}

        {live.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {live.map((t) => (
              <a
                key={t.accountId}
                href={t.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
              >
                View on {PLATFORMS[t.platform].name}
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
              </a>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
