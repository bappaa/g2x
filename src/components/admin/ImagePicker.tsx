"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Link2, Upload } from "lucide-react";

/**
 * Image field for admin forms.
 *
 * Submits two form fields:
 *  - `<fileName>` — the actual File (wins if present)
 *  - `<urlName>`  — a typed/existing URL (fallback)
 *
 * The server resolves them via resolveImageField() and stores uploads in the
 * `media` table, so icons live in the database and survive redeploys.
 */
export default function ImagePicker({
  label = "Image",
  urlName = "image",
  fileName = "imageFile",
  defaultUrl = "",
  hint,
  square,
}: {
  label?: string;
  urlName?: string;
  fileName?: string;
  defaultUrl?: string;
  hint?: string;
  square?: boolean;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [preview, setPreview] = useState(defaultUrl);
  const [fileLabel, setFileLabel] = useState("");
  const [mode, setMode] = useState<"upload" | "url">(defaultUrl ? "url" : "upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    setFileLabel(`${f.name} · ${(f.size / 1024).toFixed(0)} KB`);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const clear = () => {
    setPreview("");
    setUrl("");
    setFileLabel("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[11.5px] font-medium">{label}</label>
        <div className="ml-auto flex gap-1">
          {(["upload", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                mode === m ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
              }`}
            >
              {m === "upload" ? <Upload size={9} /> : <Link2 size={9} />}
              {m === "upload" ? "Upload" : "URL"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 overflow-hidden rounded-xl border border-[var(--line)] soft ${
            square ? "h-[68px] w-[68px]" : "h-[68px] w-[110px]"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center muted">
              <ImagePlus size={17} />
            </div>
          )}
          {preview && (
            <button
              type="button"
              onClick={clear}
              title="Remove"
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white hover:bg-rose-500"
            >
              <X size={10} />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* always present so the server keeps the existing URL when nothing changes */}
          <input type="hidden" name={urlName} value={url} />

          {mode === "upload" ? (
            <>
              <input
                ref={inputRef}
                type="file"
                name={fileName}
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg soft p-1.5 text-[11px] file:mr-2 file:rounded file:border-0 file:bg-brand-600 file:px-2 file:py-1 file:text-[10.5px] file:text-white hover:file:bg-brand-500"
              />
              {fileLabel && <p className="text-[10px] text-emerald-400">{fileLabel}</p>}
            </>
          ) : (
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(e.target.value);
              }}
              placeholder="/art/valorant.png or https://…"
              className="w-full rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[11.5px] outline-none focus:border-brand-500"
            />
          )}

          <p className="text-[10px] muted">{hint ?? "PNG, JPG, WEBP, GIF, AVIF or SVG · max 2 MB. Uploads are saved to the database."}</p>
        </div>
      </div>
    </div>
  );
}
