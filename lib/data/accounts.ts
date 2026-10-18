import "server-only";
import { connectDB } from "@/lib/db";
import { SocialAccount } from "@/models/social-account";
import { toAccountDTO } from "./serializers";

export async function listAccounts(userId: string) {
  await connectDB();
  const accounts = await SocialAccount.find({ userId }).sort({ createdAt: 1 }).lean();
  return accounts.map(toAccountDTO);
}
