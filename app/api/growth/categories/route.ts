import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { fetchCategories, fetchSubcategories } from "@/lib/providers/ypg";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parent = Number(req.nextUrl.searchParams.get("parent"));
  try {
    const items = Number.isInteger(parent) && parent > 0
      ? await fetchSubcategories(parent)
      : await fetchCategories();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[growth/categories]", err);
    return NextResponse.json({ error: "Categories are unavailable right now." }, { status: 502 });
  }
}
