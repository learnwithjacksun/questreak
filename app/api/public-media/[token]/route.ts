import { NextResponse, type NextRequest } from "next/server";
import { resolvePublicMedia } from "@/lib/publishing/public-media";

/**
 * Serves a user's media from our own domain via a signed, expiring link. Networks that only pull
 * from a verified domain (TikTok photos) use this. Only Cloudinary-hosted files can be proxied.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const source = await resolvePublicMedia(token);
  if (!source) return new NextResponse("Not found", { status: 404 });

  const upstream = await fetch(source, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
