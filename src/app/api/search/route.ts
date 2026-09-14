import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/cache";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { sanitizeName } from "@/lib/sanitize";

// Public catalog data — cache it hard at the edge.
export const revalidate = 300;

export async function GET(req: Request) {
  const ip = clientIp(headers());
  const rl = await rateLimit(`search:${ip}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { 
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) }
    });
  }

  const rawQ = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // Sanitize and limit length
  const q = sanitizeName(rawQ, 100).toLowerCase();
  if (rawQ.length > 100) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }

  const index = await getSearchIndex();
  const rows = q ? index.filter((r) => r.label.toLowerCase().includes(q)) : index;

  return NextResponse.json(rows.slice(0, 12), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}