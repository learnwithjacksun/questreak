import { z } from "zod";
import { PLATFORM_KEYS } from "@/lib/platforms";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const tiktokSettings = z.object({
  privacy: z.string().max(40).optional(),
  comment: z.boolean().optional(),
  duet: z.boolean().optional(),
  stitch: z.boolean().optional(),
  commercial: z.boolean().optional(),
  yourBrand: z.boolean().optional(),
  brandedContent: z.boolean().optional(),
});

export const postOptionsSchema = z.object({
  youtube: z
    .object({ title: z.string().max(100).optional(), privacy: z.enum(["public", "unlisted", "private"]).optional() })
    .optional(),
  pinterest: z
    .object({
      title: z.string().max(100).optional(),
      link: z.union([z.literal(""), z.string().url("Enter a valid Pinterest link")]).optional(),
      boardId: z.string().max(64).optional(),
    })
    .optional(),
  tiktok: z.record(objectId, tiktokSettings).optional(),
});

export const postInputSchema = z.object({
  id: objectId.optional(),
  text: z.string().max(63206, "Post is too long"),
  accountIds: z.array(objectId).default([]),
  mediaIds: z.array(objectId).max(10, "Attach up to 10 files").default([]),
  /** ISO string; omit for a draft. */
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  options: postOptionsSchema.optional(),
});
export type PostInput = z.input<typeof postInputSchema>;

export const postListQuerySchema = z.object({
  status: z.enum(["all", "published", "scheduled", "draft", "failed"]).default("all"),
  platform: z.enum([...PLATFORM_KEYS, "all"]).default("all"),
  q: z.string().trim().max(100).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(30, "Keep it under 30 characters"),
  avatar: z.string().url().optional().or(z.literal("")),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const notificationPrefsSchema = z.object({
  productUpdates: z.boolean(),
  publishAlerts: z.boolean(),
  orderUpdates: z.boolean(),
});

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirm: z.literal("DELETE", { error: 'Type "DELETE" to confirm' }),
});

export const boostOrderSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  link: z.string().trim().url("Enter a valid link, including https://"),
  quantity: z.coerce.number().int().positive("Enter a quantity"),
});
export type BoostOrderInput = z.input<typeof boostOrderSchema>;

export const accountPurchaseSchema = z.object({
  slug: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Minimum is 1").max(50, "Maximum is 50 per order"),
});
export type AccountPurchaseInput = z.input<typeof accountPurchaseSchema>;
