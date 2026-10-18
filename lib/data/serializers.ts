import type { IMedia } from "@/models/media";
import type { IOrder } from "@/models/order";
import type { IPost } from "@/models/post";
import type { ISocialAccount } from "@/models/social-account";
import type { AccountDTO, MediaDTO, OrderDTO, PostDTO } from "./types";

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

export function toPostDTO(p: IPost): PostDTO {
  return {
    id: String(p._id),
    text: p.text,
    status: p.status,
    scheduledFor: iso(p.scheduledFor),
    publishedAt: iso(p.publishedAt),
    createdAt: iso(p.createdAt)!,
    updatedAt: iso(p.updatedAt)!,
    platforms: [...new Set(p.targets.map((t) => t.platform))],
    targets: p.targets.map((t) => ({
      accountId: String(t.accountId),
      platform: t.platform,
      status: t.status,
      error: t.error,
      externalUrl: t.externalUrl,
    })),
    media: p.media.map((m) => ({
      mediaId: String(m.mediaId),
      url: m.url,
      resourceType: m.resourceType,
    })),
  };
}

export function toAccountDTO(a: ISocialAccount): AccountDTO {
  return {
    id: String(a._id),
    platform: a.platform,
    handle: a.handle,
    displayName: a.displayName,
    avatar: a.avatar ?? null,
    status: a.status,
    connectedAt: iso(a.createdAt)!,
    expiresAt: iso(a.expiresAt),
  };
}

export function toMediaDTO(m: IMedia): MediaDTO {
  return {
    id: String(m._id),
    url: m.url,
    name: m.name,
    resourceType: m.resourceType,
    bytes: m.bytes,
    width: m.width ?? null,
    height: m.height ?? null,
    createdAt: iso(m.createdAt)!,
  };
}

export function toOrderDTO(o: IOrder): OrderDTO {
  return {
    id: String(o._id),
    kind: o.kind,
    status: o.status,
    title: o.title,
    quantity: o.quantity,
    unitPriceNgn: o.unitPriceNgn,
    totalNgn: o.totalNgn,
    link: o.details.link ?? null,
    supplierStatus: o.supplier?.status ?? null,
    paymentStatus: o.payment.status,
    deliveredCount: o.deliveredEnc?.length ?? 0,
    error: o.error ?? null,
    createdAt: iso(o.createdAt)!,
  };
}
