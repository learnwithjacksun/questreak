import type { Metadata } from "next";
import {
  ComposeEditor,
  type ComposeInitial,
} from "@/components/dashboard/compose/compose-editor";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { listMedia } from "@/lib/data/media";
import { getPost } from "@/lib/data/posts";
import { toLocalInputValue } from "@/lib/format";

export const metadata: Metadata = { title: "Compose – Questreak" };
export const instant = false;

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string }>;
}) {
  const { edit, date } = await searchParams;
  const user = await getCurrentUser();
  const [accounts, library, post] = await Promise.all([
    listAccounts(user.id),
    listMedia(user.id),
    edit ? getPost(user.id, edit) : Promise.resolve(null),
  ]);

  let scheduledFor = "";
  if (post?.scheduledFor) scheduledFor = toLocalInputValue(new Date(post.scheduledFor));
  // `?date=YYYY-MM-DD` pre-fills 9:00 on that day (from the calendar).
  else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) scheduledFor = `${date}T09:00`;

  const initial: ComposeInitial = {
    postId: post?.id ?? null,
    text: post?.text ?? "",
    accountIds: post?.targets.map((t) => t.accountId) ?? [],
    media: post?.media.map((m) => ({ id: m.mediaId, url: m.url, resourceType: m.resourceType })) ?? [],
    scheduledFor,
  };

  return (
    <>
      <PageHeader
        title={post ? "Edit post" : "Compose"}
        description="Write once, pick your accounts, and publish or schedule."
      />
      <ComposeEditor
        // Remount when switching between posts so the store re-seeds.
        key={post?.id ?? date ?? "new"}
        accounts={accounts}
        library={library}
        initial={initial}
        userName={user.name}
      />
    </>
  );
}
