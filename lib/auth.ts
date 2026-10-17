import "server-only";
import { redirect } from "next/navigation";
import { connectDB } from "./db";
import { getSessionUserId } from "./session";
import { User } from "@/models/user";

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user || !user.emailVerified) redirect("/login?reset=1");
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}
