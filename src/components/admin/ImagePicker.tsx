"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Link2, Upload, AlertCircle, Sparkles } from "lucide-react";

// Must match src/lib/media.ts MAX_UPLOAD
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LABEL = "5 MB";
const COMPRESS_THRESHOLD = 1 * 1024 * 1024; // 1 MB — above this we auto-compress
const COMPRESS_MAX_DIM = 1024; // max width/height after compress

async function compressImage(file: File): Promise<File> {
  // Skip SVG and GIF (animated)
  if (file.type.includes("svg") || file.type === "image/gif") return file;
  if (file.size <= COMPRESS_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      // Resize if larger than max dim
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        if (width > height) {
          height = Math.round((height * COMPRESS_MAX_DIM) / width);
          width = COMPRESS_MAX_DIM;
        } else {
          width = Math.round((width * COMPRESS_MAX_DIM) / height);
          height = COMPRESS_MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // Prefer WEBP, fallback to JPEG
      const mime = file.type === "image/png" ? "image/webp" : file.type.includes("webp") ? "image/webp" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }
          // If compressed is still larger than original, keep original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }
          const newName = file.name.replace(/\.[^.]+$/, "") + (mime === "image/webp" ? ".webp" : ".jpg");
          const compressed = new File([blob], newName, { type: mime });
          resolve(compressed);
        },
        mime,
        0.82 // quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function ImagePicker({
  label = "Image",
  urlName = "image",
  fileName = "imageFile",
  defaultUrl = "",
  hint,
  square,
  maxLabel,
}: {
  label?: string;
  urlName?: string;
  fileName?: string;
  defaultUrl?: string;
  hint?: string;
  square?: boolean;
  maxLabel?: string;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [preview, setPreview] = useState(defaultUrl);
  const [fileLabel, setFileLabel] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [mode, setMode] = useState<"upload" | "url">(defaultUrl ? "url" : "upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | null) => {
    if (!f) return;
    setError("");
    setInfo("");
    
    if (f.size > MAX_BYTES) {
      setError(`Too large: ${(f.size / 1024 / 1024).toFixed(2)} MB — max ${maxLabel || MAX_LABEL}. Try compressing or use smaller image.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    let fileToUse = f;
    let wasCompressed = false;

    // Auto-compress if over 1 MB
    if (f.size > COMPRESS_THRESHOLD) {
      setCompressing(true);
      try {
        const before = f.size;
        fileToUse = await compressImage(f);
        if (fileToUse.size < before) {
          wasCompressed = true;
          setInfo(`Auto-compressed ${(before/1024/1024).toFixed(2)} MB → ${(fileToUse.size/1024).toFixed(0)} KB (${Math.round((1-fileToUse.size/before)*100)}% saved) to WEBP for faster loading.`);
        }
      } catch {
        fileToUse = f;
      }
      setCompressing(false);
    }

    // Replace the file in the input so form submits compressed version
    if (wasCompressed && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(fileToUse);
      inputRef.current.files = dt.files;
    }

    setFileLabel(
      `${fileToUse.name} · ${(fileToUse.size / 1024).toFixed(0)} KB${fileToUse.size > 1024*1024 ? ` (${(fileToUse.size/1024/1024).toFixed(2)} MB)` : ""}${wasCompressed ? " · auto-compressed" : ""}`
    );
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(fileToUse);
  };

  const clear = () => {
    setPreview("");
    setUrl("");
    setFileLabel("");
    setError("");
    setInfo("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const maxText = maxLabel || MAX_LABEL;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[11.5px] font-medium">{label}</label>
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
          Max {maxText}
        </span>
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
            <img loading="lazy" decoding="async" src={preview} alt="" className="h-full w-full object-cover" />
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
              {compressing && <p className="text-[10px] text-amber-400 animate-pulse">Compressing image to WEBP for faster loading…</p>}
              {fileLabel && !compressing && <p className="text-[10px] text-emerald-400">{fileLabel}</p>}
              {info && !compressing && (
                <p className="flex items-center gap-1 text-[10px] text-sky-400">
                  <Sparkles size={11} /> {info}
                </p>
              )}
              {error && (
                <p className="flex items-center gap-1 text-[10px] font-medium text-rose-400">
                  <AlertCircle size={11} /> {error}
                </p>
              )}
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

          <p className="text-[10px] leading-relaxed muted">
            {hint ?? (
              <>
                PNG, JPG, WEBP, GIF, AVIF or SVG · <b className="text-amber-300">max {maxText}</b> · Recommended 512×512 square, under 1 MB. Images over 1 MB auto-compress to WEBP.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
