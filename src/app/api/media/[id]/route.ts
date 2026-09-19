/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { headers } from "next/headers";

let sharpMod: any = null;
let sharpChecked = false;
async function getSharp() {
  if (sharpChecked) return sharpMod;
  sharpChecked = true;
  try {
    const m = await import("sharp");
    sharpMod = (m as any).default || m;
  } catch {
    sharpMod = null;
  }
  return sharpMod;
}

/** Serves an image stored in the `media` table. Public + immutably cached + bandwidth optimized. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ip = clientIp(headers());
  const rl = await rateLimit(`media_fetch:${ip}`, 300, 60);
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

  const etag = `"${params.id}-${body.byteLength}-${requestedWidth}"`;
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

  // Only optimize if resize requested or client supports webp and image is large enough to benefit
  const shouldOptimize = requestedWidth > 0 || (acceptHeader.includes("image/webp") && body.byteLength > 80 * 1024 && mime !== "image/svg+xml" && mime !== "image/gif");

  if (shouldOptimize) {
    try {
      const sharp = await getSharp();
      if (sharp) {
        let pipeline = sharp(body, { failOn: "none" });

        if (requestedWidth > 0) {
          pipeline = pipeline.resize({ width: requestedWidth, withoutEnlargement: true, fastShrinkOnLoad: true });
        }

        if (mime !== "image/gif" && acceptHeader.includes("image/webp")) {
          pipeline = pipeline.webp({ quality: requestedWidth ? 78 : 80 });
          mime = "image/webp";
        } else if (requestedWidth > 0) {
          // When resizing but not webp, compress appropriately
          if (mime === "image/jpeg") pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
          else if (mime === "image/png") pipeline = pipeline.png({ compressionLevel: 8 });
        }

        const out = await pipeline.toBuffer();
        if (out.byteLength < body.byteLength * 1.1 || requestedWidth > 0) {
          body = out;
        }
      }
    } catch {
      // Serve original on failure
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
      Vary: "Accept",
      "CDN-Cache-Control": "public, max-age=31536000",
    },
  });
}
