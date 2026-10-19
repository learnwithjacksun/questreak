"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, File02Icon } from "@hugeicons/core-free-icons";
import { EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { buttonClass } from "@/components/ui/button";
import type { PostDTO } from "@/lib/data/types";
import { PostRow } from "./post-row";

type Tab = "published" | "scheduled";

export function RecentActivity({
  published,
  scheduled,
  stats,
}: {
  published: PostDTO[];
  scheduled: PostDTO[];
  stats: { published: number; scheduled: number };
}) {
  const [tab, setTab] = useState<Tab>("published");
  const list = tab === "published" ? published : scheduled;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 sm:gap-3 sm:px-5">
        <Tabs<Tab>
          className="-mb-px min-w-0 border-b-0"
          value={tab}
          onChange={setTab}
          items={[
            { value: "published", label: "Published", count: stats.published },
            { value: "scheduled", label: "Scheduled", count: stats.scheduled },
          ]}
        />
        <Link
          href={`/dashboard/posts?status=${tab}`}
          className="shrink-0 pb-0.5 pr-1 text-xs text-muted transition-colors hover:text-foreground sm:text-sm"
        >
          View all
        </Link>
      </div>
      <div className="border-t border-border">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState
              className="border-0 py-10"
              icon={tab === "published" ? File02Icon : Calendar03Icon}
              title={tab === "published" ? "Nothing published yet" : "No scheduled posts"}
              description={
                tab === "published"
                  ? "Posts you publish will show up here with their status on each network."
                  : "Schedule a post and it will wait here until it goes out."
              }
              action={
                <Link href="/dashboard/compose" className={buttonClass("outline", "sm")}>
                  <HugeiconsIcon icon={File02Icon} size={16} />
                  Write a post
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((p) => (
              <li key={p.id}>
                <PostRow post={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
