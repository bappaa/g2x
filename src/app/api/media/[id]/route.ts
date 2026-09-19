/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { headers } from "next/headers";

/** Serves an image stored in the `media` table. Public + immutably cached + bandwidth optimized. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Rate limit media endpoint to prevent abuse
  const ip = clientIp(headers());
  const rl = await rateLimit(`media_fetch:${ip}`, 200, 60);
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  if (!/^[a-z0-9_-]{8,64}$/i.test(params.id)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const url = new URL(req.url);
  const wParam = url.searchParams.get("w");
  const requestedWidth = wParam ? Math.min(Math.max(parseInt(wParam, 10) || 0, 0), 1024) : 0;
  const acceptHeader = req.headers.get("accept") || "";

  const row = await getMedia(params.id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  let body = Buffer.from(row.data, "base64");
  let mime = row.mime;
  const cacheControl = "public, max-age=31536000, immutable";

  // ETag handling for bandwidth saving
  const etag = `"${params.id}-${body.byteLength}"`;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": cacheControl,
      },
    });
  }

  // Try to use sharp for resizing / WebP conversion if available and not SVG
  if (mime !== "image/svg+xml" && (requestedWidth > 0 || acceptHeader.includes("image/webp") || body.byteLength > 200 * 1024)) {
    try {
      // Dynamic import to avoid crash if sharp not installed
      const sharp = (await import("sharp").catch(() => null) as any)?.default || (await import("sharp").catch(() => null) as any);
      if (sharp) {
        let pipeline = sharp(body);

        // Resize if requested
        if (requestedWidth > 0) {
          pipeline = pipeline.resize({ width: requestedWidth, withoutEnlargement: true });
        } else if (body.byteLength > 300 * 1024) {
          // Auto-downscale large images to max 1024 width for bandwidth saving
          const meta = await pipeline.metadata().catch(() => null);
          if (meta && meta.width && meta.width > 1024) {
            pipeline = pipeline.resize({ width: 1024, withoutEnlargement: true });
          }
        }

        // Convert to WebP if client supports it and original is not GIF (to preserve animation)
        if (mime !== "image/gif" && acceptHeader.includes("image/webp")) {
          pipeline = pipeline.webp({ quality: 80 });
          mime = "image/webp";
        } else if (mime === "image/png" || mime === "image/jpeg") {
          // For large JPEG/PNG, compress more
          if (mime === "image/jpeg") {
            pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
          } else if (mime === "image/png") {
            pipeline = pipeline.png({ compressionLevel: 8, quality: 80 });
          }
        }

        const out = await pipeline.toBuffer();
        // Only use optimized if smaller or resize requested
        if (out.byteLength < body.byteLength || requestedWidth > 0) {
          body = out;
        }
      }
    } catch {
      // Sharp not available or failed — serve original
    }
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
      "Vary": "Accept",
      // Allow CDN to cache
      "CDN-Cache-Control": "public, max-age=31536000",
    },
  });
}
