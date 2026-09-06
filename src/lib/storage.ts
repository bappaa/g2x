import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Private file storage for KYC documents.
 *
 * Files are written OUTSIDE /public so they are never publicly reachable —
 * they can only be read back through /api/kyc/[id] which checks that the
 * requester is the owner or an admin.
 *
 * Swap the two fs calls for S3/R2/UploadThing in production; the returned
 * key stays the same shape so nothing else changes.
 */

const ROOT = process.env.KYC_STORAGE_DIR || join(process.cwd(), ".private-uploads");

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export type SaveResult = { ok: true; key: string } | { ok: false; error: string };

export async function saveKycFile(file: File, userId: string, kind: string): Promise<SaveResult> {
  if (!file || file.size === 0) return { ok: false, error: `Please attach the ${kind} image.` };
  if (file.size > MAX_BYTES) return { ok: false, error: `${kind} must be under 8 MB.` };
  if (!ALLOWED.includes(file.type))
    return { ok: false, error: `${kind} must be a JPG, PNG, WEBP or PDF file.` };

  const ext =
    file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" :
    file.type === "image/webp" ? "webp" : "jpg";

  const dir = join(ROOT, userId);
  const name = `${kind}-${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  try {
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(join(dir, name), buf);
  } catch (e) {
    /**
     * Serverless platforms (Netlify/Vercel functions) mount a read-only
     * filesystem apart from /tmp, so this throws EROFS/EACCES. Surface a clear
     * message instead of letting it bubble up as a generic 500 that looks like
     * the whole site is broken.
     */
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.error("[kyc:storage] read-only filesystem at", ROOT, "-", code);
      return {
        ok: false,
        error:
          "Document uploads are not available on this deployment (read-only storage). " +
          "Set KYC_STORAGE_DIR to a writable disk, or host on a VPS.",
      };
    }
    console.error("[kyc:storage]", e);
    return { ok: false, error: "Could not save the file. Please try again." };
  }

  return { ok: true, key: `${userId}/${name}` };
}

export const kycFilePath = (key: string) => join(ROOT, key);

export const kycContentType = (key: string) =>
  key.endsWith(".pdf") ? "application/pdf" :
  key.endsWith(".png") ? "image/png" :
  key.endsWith(".webp") ? "image/webp" : "image/jpeg";
