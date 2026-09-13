import "server-only";
import { all, one, run, nid } from "./db";

export const MAX_UPLOAD = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
];

// Magic bytes for file type verification (prevent MIME spoofing)
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4E, 0x47]],
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF
  "image/gif": [[0x47, 0x49, 0x46, 0x38]], // GIF8
  "image/avif": [[0x00, 0x00, 0x00]], // AVIF has ftyp at offset 4, check separately
};

function checkMagicBytes(buf: Buffer, mime: string): boolean {
  if (mime === "image/svg+xml") return true; // SVG checked separately
  if (mime === "image/avif") {
    // AVIF: check for ftyp at offset 4
    const header = buf.subarray(4, 8).toString();
    return header === "ftyp";
  }
  const sigs = MAGIC_BYTES[mime];
  if (!sigs) return false;
  return sigs.some((sig) => sig.every((byte, i) => buf[i] === byte));
}

function isSafeSvg(content: string): { safe: boolean; reason?: string } {
  const lower = content.toLowerCase();
  // Block dangerous SVG features
  const dangerous = [
    "<script", "javascript:", "onload=", "onerror=", "onclick=", "onmouseover=",
    "<foreignobject", "<iframe", "eval(", "fromcharcode", "data:text/html",
    "<!entity", "<!doctype", "xlink:href=\"data:", "href=\"javascript:",
  ];
  for (const d of dangerous) {
    if (lower.includes(d)) return { safe: false, reason: `SVG contains forbidden: ${d}` };
  }
  // Must be valid SVG
  if (!lower.includes("<svg")) return { safe: false, reason: "Not a valid SVG" };
  // Size check for SVG
  if (content.length > 100 * 1024) return { safe: false, reason: "SVG too large" };
  return { safe: true };
}

export type MediaRow = {
  id: string; kind: string; name: string; mime: string;
  size: number; ref_key: string | null; created_at: string;
};

/** Public URL for a stored media row. */
export const mediaUrl = (id: string) => `/api/media/${id}`;

/**
 * Persist an uploaded file into the `media` table (base64 in the DB, so it
 * works on serverless hosts with no writable disk and survives deploys).
 * Returns the public URL to store on the game/banner row.
 * 
 * Enhanced with magic byte verification, SVG XSS protection, and size checks.
 */
export async function saveMedia(
  file: File,
  opts: { kind?: string; refKey?: string | null; userId?: string } = {}
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!file || typeof file === "string" || file.size === 0)
    return { ok: false, error: "No file was uploaded." };

  if (file.size > MAX_UPLOAD)
    return { ok: false, error: `Image is too large — the maximum is ${MAX_UPLOAD / 1024 / 1024} MB.` };

  // Validate filename - no path traversal, no executable
  const fileName = file.name.slice(0, 120) || "upload";
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return { ok: false, error: "Invalid filename" };
  }
  if (/\.(php|exe|sh|bat|js|html|htm)$/i.test(fileName)) {
    return { ok: false, error: "Executable files not allowed" };
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime))
    return { ok: false, error: "Use a PNG, JPG, WEBP, GIF, AVIF or SVG image." };

  const buf = Buffer.from(await file.arrayBuffer());

  // Magic byte verification - prevent MIME spoofing
  if (!checkMagicBytes(buf, mime)) {
    // For JPEG, also allow if it starts with FF D8 FF
    if (!(mime === "image/jpeg" && buf[0] === 0xFF && buf[1] === 0xD8)) {
      return { ok: false, error: "File content does not match its type - possible spoofing attempt" };
    }
  }

  // SVG XSS protection
  if (mime === "image/svg+xml") {
    const content = buf.toString("utf-8");
    const svgCheck = isSafeSvg(content);
    if (!svgCheck.safe) {
      return { ok: false, error: `Unsafe SVG: ${svgCheck.reason}` };
    }
  }

  // Additional check: ensure image is not too small (1x1 tracking pixel) or too large dimensions
  // We do basic check - real dimension check would need sharp, but we can at least check file isn't empty
  if (buf.length < 100) {
    return { ok: false, error: "Image file too small or corrupted" };
  }

  const id = nid("med_");

  await run(
    `INSERT INTO media (id,kind,name,mime,data,size,ref_key,created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      opts.kind ?? "image",
      fileName,
      mime,
      buf.toString("base64"),
      buf.byteLength,
      opts.refKey ?? null,
      opts.userId ?? null,
    ]
  );

  return { ok: true, id, url: mediaUrl(id) };
}

export async function getMedia(id: string) {
  return one<{ mime: string; data: string }>(`SELECT mime, data FROM media WHERE id=?`, [id]);
}

export async function listMedia(kind?: string, limit = 120) {
  return kind && kind !== "all"
    ? all<MediaRow>(
        `SELECT id,kind,name,mime,size,ref_key,created_at FROM media
          WHERE kind=? ORDER BY created_at DESC LIMIT ?`,
        [kind, limit]
      )
    : all<MediaRow>(
        `SELECT id,kind,name,mime,size,ref_key,created_at FROM media
          ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );
}

export async function deleteMedia(id: string) {
  await run(`DELETE FROM media WHERE id=?`, [id]);
}

/**
 * Accepts whatever the admin form supplied for an image field and resolves it
 * to a URL: an uploaded file wins, otherwise the typed URL is kept.
 */
export async function resolveImageField(
  form: FormData,
  fileField: string,
  urlField: string,
  opts: { kind?: string; refKey?: string | null; userId?: string } = {}
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const f = form.get(fileField);
  if (f && typeof f !== "string" && f.size > 0) {
    const r = await saveMedia(f as File, opts);
    if (!r.ok) return r;
    return { ok: true, url: r.url };
  }
  return { ok: true, url: String(form.get(urlField) ?? "").trim() };
}