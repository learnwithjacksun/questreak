import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connectDB } from "./db";
import { getSessionUserId } from "./session";
import { User } from "@/models/user";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  plan: "free" | "pro" | "team";
  role: "user" | "admin";
  notificationPrefs: { productUpdates: boolean; publishAlerts: boolean; orderUpdates: boolean };
  hasPassword: boolean;
  createdAt: Date;
};

/** Current signed-in user. Deduplicated per request. Redirects to /login when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user || !user.emailVerified) redirect("/login?reset=1");
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
    plan: user.plan ?? "free",
    role: user.role ?? "user",
    notificationPrefs: {
      productUpdates: user.notificationPrefs?.productUpdates ?? true,
      publishAlerts: user.notificationPrefs?.publishAlerts ?? true,
      orderUpdates: user.notificationPrefs?.orderUpdates ?? true,
    },
    hasPassword: !!user.passwordHash,
    createdAt: user.createdAt,
  };
});
