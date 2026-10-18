import type { PlatformKey } from "@/lib/platforms";
import type { PostStatus } from "@/models/post";
import type { OrderKind, OrderStatus } from "@/models/order";

/** Plain, JSON-safe shapes passed from server to client components. */
export type PostDTO = {
  id: string;
  text: string;
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  platforms: PlatformKey[];
  targets: {
    accountId: string;
    platform: PlatformKey;
    status: "pending" | "published" | "failed";
    error?: string;
    externalUrl?: string;
  }[];
  media: { mediaId: string; url: string; resourceType: "image" | "video" }[];
};

export type AccountDTO = {
  id: string;
  platform: PlatformKey;
  handle: string;
  displayName: string;
  avatar: string | null;
  status: "active" | "expired" | "error";
  connectedAt: string;
  expiresAt: string | null;
};

export type MediaDTO = {
  id: string;
  url: string;
  name: string;
  resourceType: "image" | "video";
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type OrderDTO = {
  id: string;
  kind: OrderKind;
  status: OrderStatus;
  title: string;
  quantity: number;
  unitPriceNgn: number;
  totalNgn: number;
  link: string | null;
  supplierStatus: string | null;
  paymentStatus: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  deliveredCount: number;
  error: string | null;
  createdAt: string;
};
