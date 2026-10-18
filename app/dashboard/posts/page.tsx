import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { PostsView } from "@/components/dashboard/posts-view";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Posts – Questreak" };
export const instant = false;

const statuses = ["all", "published", "scheduled", "draft", "failed"] as const;

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initial = statuses.find((s) => s === status) ?? "all";

  return (
    <>
      <PageHeader
        title="Posts"
        description="Everything you've written, scheduled and published."
        actions={
          <LinkButton href="/dashboard/compose" icon={<HugeiconsIcon icon={Add01Icon} size={18} />}>
            New post
          </LinkButton>
        }
      />
      <PostsView initialStatus={initial} />
    </>
  );
}
