import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { PlatformIcon } from "@/components/ui/primitives";
import type { PostDTO } from "@/lib/data/types";
import { LocalTime } from "./local-time";
import { PostStatusBadge } from "./status-badge";

/** One post in a list: platforms, text preview, media count, status and time. */
export function PostRow({ post, actions }: { post: PostDTO; actions?: ReactNode }) {
  const when =
    post.status === "scheduled" && post.scheduledFor
      ? post.scheduledFor
      : (post.publishedAt ?? post.updatedAt);
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
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
