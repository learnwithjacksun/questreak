import type { Metadata } from "next";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { postsInRange } from "@/lib/data/posts";

export const metadata: Metadata = { title: "Calendar – Questreak" };
export const instant = false;

const DAY = 24 * 60 * 60 * 1000;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  const view = sp.view === "week" ? "week" : "month";
  const valid = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(Date.parse(sp.date));
  const anchor = valid ? sp.date! : new Date().toISOString().slice(0, 10);

  // Generous window so any viewer time zone still sees every post in its grid; bucketing is client-side.
  const a = new Date(`${anchor}T00:00:00Z`);
  const from =
    view === "week"
      ? new Date(a.getTime() - 9 * DAY)
      : new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1) - 9 * DAY);
  const to =
    view === "week"
      ? new Date(a.getTime() + 9 * DAY)
      : new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1) + 9 * DAY);

  const posts = await postsInRange(user.id, from, to);

  return (
    <>
      <PageHeader title="Calendar" description="See what's going out and when." />
      <CalendarView key={`${view}-${anchor}`} anchor={anchor} view={view} posts={posts} />
    </>
  );
}
