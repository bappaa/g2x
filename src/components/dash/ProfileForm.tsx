"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Camera, Trash2 } from "lucide-react";
import { Btn, Field, inputCls, Section, Tag } from "@/components/ui";

import { updateProfileAction } from "@/lib/actions/auth";
import LocalTime from "@/components/LocalTime";

export default function ProfileForm({
  name, email, phone, country, provider, joined, avatar,
}: {
  name: string; email: string; phone: string; country: string; provider: string; joined: string;
  avatar?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* ---------------------------- avatar ---------------------------- */
  const picker = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatar ?? null);
  const [removed, setRemoved] = useState(false);

  /**
   * Downscale in the browser before upload.
   *
   * A modern phone photo is 3-8 MB, which would be rejected by the 1 MB server
   * cap and is absurd for a 96px circle anyway. Resizing to 256px keeps the
   * stored data URI around 20 KB and makes the upload instant.
   */
  const pickAvatar = async (file: File) => {
    setErr("");
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setErr("Choose a PNG, JPEG or WEBP image.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");

      // Cover-crop to a square so the circle is never distorted.
      const scale = Math.max(size / bitmap.width, size / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

      setPreview(canvas.toDataURL("image/webp", 0.9));
      setRemoved(false);
    } catch {
      // Fall back to the raw file; the server still validates it.
      setPreview(URL.createObjectURL(file));
      setRemoved(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Profile</h1>

      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            title="Change profile photo"
            className="group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[18px] font-black text-white sm:text-[22px]"
          >
            {preview && !removed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
            <span className="absolute inset-0 hidden place-items-center bg-black/55 group-hover:grid">
              <Camera size={18} />
            </span>
          </button>
          <div>
            <div className="text-[16px] font-bold">{name}</div>
            <div className="text-[12px] muted">{email}</div>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="text-[11.5px] font-semibold text-brand-400 hover:underline"
              >
                Change photo
              </button>
              {preview && !removed && (
                <button
                  type="button"
                  onClick={() => { setRemoved(true); setPreview(null); }}
                  className="flex items-center gap-1 text-[11.5px] muted transition-colors hover:text-rose-400"
                >
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Tag tone="green">Verified buyer</Tag>
              <Tag tone="slate">{provider === "google" ? "Google account" : "Email account"}</Tag>
              {joined && <Tag tone="slate">Joined <LocalTime at={joined} mode="date" /></Tag>}
            </div>
          </div>
        </div>
      </div>

      <Section title="Personal information">
        <form
          action={(fd) =>
            start(async () => {
              setErr(""); setMsg("");

              /*
               * The picker gives us a downscaled data URI, not the original
               * File, so convert it back to a Blob the action can read —
               * uploading the raw input would send the full-size phone photo.
               *
               * Decoded with atob rather than fetch(): the site's CSP has no
               * `data:` in connect-src, so `fetch("data:…")` is blocked and
               * fails with "Failed to fetch", which silently dropped the photo.
               */
              if (preview && !removed && preview.startsWith("data:")) {
                const [meta, b64] = preview.split(",");
                const type = /:(.*?);/.exec(meta)?.[1] ?? "image/webp";
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const ext = type.split("/")[1] ?? "webp";
                fd.set("avatarFile", new File([bytes], `avatar.${ext}`, { type }));
              } else {
                fd.delete("avatarFile");
              }

              const r = await updateProfileAction(fd);
              if (!r.ok) return setErr(r.error || "Could not save.");
              setMsg("Profile updated.");
              router.refresh();
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          {/*
            The avatar lives inside this form so "Save changes" commits the
            photo and the text fields together — no second button, no way to
            leave a half-applied profile behind.
          */}
          <input
            ref={picker}
            type="file"
            name="avatarFile"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickAvatar(f);
            }}
          />
          {removed && <input type="hidden" name="removeAvatar" value="1" />}

          <Field label="Full name">
            <input name="name" defaultValue={name} className={inputCls} />
          </Field>
          <Field label="Email (read only)">
            <input value={email} readOnly className={inputCls} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={phone} className={inputCls} placeholder="Phone number" />
          </Field>
          <Field label="Country">
            <input name="country" defaultValue={country} className={inputCls} placeholder="Country" />
          </Field>
          <div className="sm:col-span-2">
            {err && <div className="mb-2 text-[11.5px] text-rose-400">{err}</div>}
            {msg && (
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-emerald-400">
                <Check size={13} /> {msg}
              </div>
            )}
            <Btn className="flex items-center gap-2" disabled={pending}>
              {pending && <Loader2 size={13} className="animate-spin" />} Save changes
            </Btn>
          </div>
        </form>
      </Section>
    </div>
  );
}
