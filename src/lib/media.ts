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
 */
export async function saveMedia(
  file: File,
  opts: { kind?: string; refKey?: string | null; userId?: string } = {}
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!file || typeof file === "string" || file.size === 0)
    return { ok: false, error: "No file was uploaded." };

  if (file.size > MAX_UPLOAD)
    return { ok: false, error: `Image is too large — the maximum is ${MAX_UPLOAD / 1024 / 1024} MB.` };

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime))
    return { ok: false, error: "Use a PNG, JPG, WEBP, GIF, AVIF or SVG image." };

  const buf = Buffer.from(await file.arrayBuffer());
  const id = nid("med_");

  await run(
    `INSERT INTO media (id,kind,name,mime,data,size,ref_key,created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      opts.kind ?? "image",
      file.name.slice(0, 120) || "upload",
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
