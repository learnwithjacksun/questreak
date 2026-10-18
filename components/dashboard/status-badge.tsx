import { Badge } from "@/components/ui/primitives";
import type { PostStatus } from "@/models/post";
import type { OrderStatus } from "@/models/order";

const postMap: Record<PostStatus, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  publishing: { label: "Publishing", tone: "warning" },
  published: { label: "Published", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const s = postMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const orderMap: Record<OrderStatus, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  paid: { label: "Paid", tone: "info" },
  fulfilling: { label: "Processing", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = orderMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
