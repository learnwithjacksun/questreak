import { NextResponse, type NextRequest } from "next/server";
import { listPosts, postCounts } from "@/lib/data/posts";
import { getSessionUserId } from "@/lib/session";
import { postListQuerySchema } from "@/lib/validators/dashboard";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const [list, counts] = await Promise.all([
    listPosts(userId, parsed.data),
    postCounts(userId, parsed.data),
  ]);
  return NextResponse.json({ ...list, counts });
}
