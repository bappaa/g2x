import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { headers } from "next/headers";

/** Serves an image stored in the `media` table. Public + immutably cached. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Rate limit media endpoint to prevent abuse (gaming sites get scraped heavily)
  const ip = clientIp(headers());
  const rl = await rateLimit(`media_fetch:${ip}`, 100, 60);
  if (!rl.ok) {
    return new NextResponse("Too many requests", { 
      status: 429, 
      headers: { "Retry-After": String(rl.retryAfter) } 
    });
  }

  // Validate ID format to prevent path traversal
  if (!/^[a-z0-9_-]{8,64}$/i.test(params.id)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const row = await getMedia(params.id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const body = Buffer.from(row.data, "base64");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}