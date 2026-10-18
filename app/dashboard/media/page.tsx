import type { Metadata } from "next";
import { MediaLibrary } from "@/components/dashboard/media-library";
import { PageHeader } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { listMedia } from "@/lib/data/media";

export const metadata: Metadata = { title: "Media – Questreak" };
export const instant = false;

export default async function MediaPage() {
  const user = await getCurrentUser();
  const items = await listMedia(user.id);

  return (
    <>
      <PageHeader
        title="Media"
        description="Your image and video library. Upload once, attach to any post."
      />
      <MediaLibrary items={items} />
    </>
  );
}
