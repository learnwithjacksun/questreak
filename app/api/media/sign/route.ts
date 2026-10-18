import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

/** Signs a direct-to-Cloudinary upload, locked to the caller's own folder. */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Media uploads aren't configured." }, { status: 503 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `questreak/${userId}`;
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
  return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
}
