/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { all, one, run, nid } from "./db";

export const MAX_UPLOAD = 5 * 1024 * 1024; // 5 MB — was 2 MB, 1.07 MB failed due to unclear limit + strict magic check
export const MAX_UPLOAD_LABEL = "5 MB";
export const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/jpg", // some browsers send jpg
];

// Magic bytes for file type verification (prevent MIME spoofing)
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/jpg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF
  "image/gif": [[0x47, 0x49, 0x46, 0x38]], // GIF8
  "image/avif": [[0x00, 0x00, 0x00]],
};

function checkMagicBytes(buf: Buffer, mime: string): boolean {
  if (mime === "image/svg+xml") return true; // SVG checked separately
  if (mime === "image/avif" || mime === "image/jpg") {
    if (mime === "image/avif") {
      const header = buf.subarray(4, 8).toString();
      return header === "ftyp" || buf.subarray(0, 4).toString() === "RIFF";
    }
    // jpg = jpeg
    return buf[0] === 0xff && buf[1] === 0xd8;
  }
  const sigs = MAGIC_BYTES[mime];
  if (!sigs) return false;
  return sigs.some((sig) => sig.every((byte, i) => buf[i] === byte));
}

function isSafeSvg(content: string): { safe: boolean; reason?: string } {
  const lower = content.toLowerCase();
  const dangerous = [
    "<script", "javascript:", "onload=", "onerror=", "onclick=", "onmouseover=",
    "<foreignobject", "<iframe", "eval(", "fromcharcode", "data:text/html",
    "<!entity", "<!doctype", 'xlink:href="data:', 'href="javascript:',
  ];
  for (const d of dangerous) {
    if (lower.includes(d)) return { safe: false, reason: `SVG contains forbidden: ${d}` };
  }
  if (!lower.includes("<svg")) return { safe: false, reason: "Not a valid SVG" };
  if (content.length > 200 * 1024) return { safe: false, reason: "SVG too large (max 200 KB)" };
  return { safe: true };
}

export type MediaRow = {
  id: string; kind: string; name: string; mime: string;
  size: number; ref_key: string | null; created_at: string;
};

export const mediaUrl = (id: string) => `/api/media/${id}`;

export async function saveMedia(
  file: File,
  opts: { kind?: string; refKey?: string | null; userId?: string } = {}
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  try {
    if (!file || typeof file === "string" || file.size === 0)
      return { ok: false, error: "No file was uploaded." };

    if (file.size > MAX_UPLOAD)
      return { ok: false, error: `Image is too large — maximum ${MAX_UPLOAD_LABEL} allowed. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.` };

    const fileName = file.name.slice(0, 120) || "upload";
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      return { ok: false, error: "Invalid filename" };
    }
    if (/\.(php|exe|sh|bat|js|html|htm)$/i.test(fileName)) {
      return { ok: false, error: "Executable files not allowed" };
    }

    let mime = (file.type || "application/octet-stream").toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    const allowedNormalized = ALLOWED_MIME.map((m) => (m === "image/jpg" ? "image/jpeg" : m));
    if (!allowedNormalized.includes(mime)) {
      return { ok: false, error: `Unsupported image type (${file.type || "unknown"}). Use PNG, JPG, WEBP, GIF, AVIF or SVG — max ${MAX_UPLOAD_LABEL}.` };
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // Magic byte check — relaxed: JPEG/WEBP have variants, don't block on strict sig
    if (!checkMagicBytes(buf, mime)) {
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isWebp = buf.subarray(0, 4).toString() === "RIFF";
      const isGif = buf.subarray(0, 3).toString() === "GIF";
      if (!(isJpeg || isPng || isWebp || isGif)) {
        // Still allow if mime is svg (checked below)
        if (mime !== "image/svg+xml") {
          return { ok: false, error: "File content doesn't look like an image — try re-exporting as PNG/JPG." };
        }
      }
    }

    if (mime === "image/svg+xml") {
      const content = buf.toString("utf-8");
      const svgCheck = isSafeSvg(content);
      if (!svgCheck.safe) {
        return { ok: false, error: `Unsafe SVG: ${svgCheck.reason}` };
      }
    }

    if (buf.length < 80) {
      return { ok: false, error: "Image file too small or corrupted (less than 80 bytes)." };
    }

    let finalBuf = buf;
    let finalMime = mime;

    // Server-side compression for bandwidth saving — if image >1 MB, try to compress to WebP/JPEG 1024px
    if (buf.byteLength > 1024 * 1024 && mime !== "image/svg+xml" && mime !== "image/gif") {
      try {
        const sharpMod = await import("sharp").catch(() => null) as any;
        const sharp = sharpMod?.default || sharpMod;
        if (sharp) {
          let pipeline = sharp(buf);
          const meta = await pipeline.metadata().catch(() => null);
          if (meta && meta.width && meta.width > 1024) {
            pipeline = pipeline.resize({ width: 1024, withoutEnlargement: true });
          }
          // Convert to WebP for better compression (unless original is PNG with transparency needed? WebP supports alpha)
          if (mime === "image/png" || mime === "image/jpeg") {
            pipeline = pipeline.webp({ quality: 82 });
            finalMime = "image/webp";
          } else if (mime === "image/webp" || mime === "image/avif") {
            pipeline = pipeline.webp({ quality: 82 });
            finalMime = "image/webp";
          }
          const out = await pipeline.toBuffer();
          if (out.byteLength < buf.byteLength) {
            finalBuf = out;
          }
        }
      } catch {
        // sharp not available — keep original
      }
    }

    const id = nid("med_");

    await run(
      `INSERT INTO media (id,kind,name,mime,data,size,ref_key,created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        id,
        opts.kind ?? "image",
        fileName,
        finalMime,
        finalBuf.toString("base64"),
        finalBuf.byteLength,
        opts.refKey ?? null,
        opts.userId ?? null,
      ]
    );

    return { ok: true, id, url: mediaUrl(id) };
  } catch (e: unknown) {
    const msg = (e as Error)?.message || String(e);
    // Don't leak internal DB errors, but give actionable message
    if (/too large|payload|body size/i.test(msg)) {
      return { ok: false, error: `Upload failed — file too large for server. Max ${MAX_UPLOAD_LABEL}. Try compressing to under 3 MB.` };
    }
    console.error("[saveMedia] failed", msg);
    return { ok: false, error: `Upload failed: ${msg.slice(0, 200)}. Try a smaller image (max ${MAX_UPLOAD_LABEL}, PNG/JPG/WEBP).` };
  }
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
