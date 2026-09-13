import { NextResponse } from "next/server";
import { getMedia } from "@/lib/media";

/** Serves an image stored in the `media` table. Public + immutably cached. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = await getMedia(params.id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const body = Buffer.from(row.data, "base64");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.byteLength),
      // Media ids are content-addressed on insert, so this can cache hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
