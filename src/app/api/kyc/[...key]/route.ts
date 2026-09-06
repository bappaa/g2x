import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/db";
import { kycFilePath, kycContentType } from "@/lib/storage";

/**
 * Serves a private KYC document.
 * Access: the owner of the document, or any admin. Nobody else.
 */
export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const u = await getSessionUser();
  if (!u) return new NextResponse("Unauthorized", { status: 401 });

  const key = params.key.join("/");
  // Path traversal / absolute path / NUL guard. The DB lookup below is the real
  // authority, but never let a crafted key reach the filesystem helpers.
  if (!/^[A-Za-z0-9_\-]+\/[A-Za-z0-9._\-]+$/.test(key) || key.includes(".."))
    return new NextResponse("Bad request", { status: 400 });

  // The key must belong to a real verification row — seller or buyer.
  let row = await one<{ user_id: string }>(
    `SELECT user_id FROM seller_verifications
      WHERE front_path=? OR back_path=? OR selfie_path=? LIMIT 1`,
    [key, key, key]
  );
  if (!row)
    row = await one<{ user_id: string }>(
      `SELECT user_id FROM buyer_verifications
        WHERE id_photo_path=? OR face_photo_path=? LIMIT 1`,
      [key, key]
    );
  if (!row) return new NextResponse("Not found", { status: 404 });

  const isAdmin = u.role === "admin";
  if (!isAdmin && row.user_id !== u.id)
    return new NextResponse("Forbidden", { status: 403 });

  try {
    const buf = await readFile(kycFilePath(key));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": kycContentType(key),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
