import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { fetchSmmServices } from "@/lib/providers/smm";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ services: await fetchSmmServices() });
  } catch (err) {
    console.error("[growth/services]", err);
    return NextResponse.json(
      { error: "Boost services are unavailable right now." },
      { status: 502 },
    );
  }
}
