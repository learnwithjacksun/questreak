import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { fetchListings } from "@/lib/providers/ypg";

const querySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  subcategoryId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["sort_key", "total_price", "available_stock", "title"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  try {
    return NextResponse.json(await fetchListings(parsed.data));
  } catch (err) {
    console.error("[growth/listings]", err);
    return NextResponse.json({ error: "Listings are unavailable right now." }, { status: 502 });
  }
}
