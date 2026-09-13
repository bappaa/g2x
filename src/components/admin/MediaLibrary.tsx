"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Trash2, Loader2, Copy, Check, Gamepad2, X, ImagePlus } from "lucide-react";
import { Tag, Empty, inputCls } from "@/components/ui";
import { Toolbar, IconAction } from "@/components/admin/ui";

import { copyText } from "@/lib/creds";
import { uploadMediaAction, deleteMediaAction, setGameIconAction } from "@/lib/actions/admin";
import LocalTime from "@/components/LocalTime";

type M = {
  id: string; kind: string; name: string; mime: string;
  size: number; ref_key: string | null; created_at: string;
};
type G = { slug: string; name: string; logo: string };

const KINDS = ["all", "game_icon", "banner", "product", "logo", "image"];

export default function MediaLibrary({ rows, games, kind }: { rows: M[]; games: G[]; kind: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [assign, setAssign] = useState<M | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    start(async () => {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("kind", kind === "all" ? "image" : kind);
        const r = await uploadMediaAction(fd);
        if (!r.ok) {
          setErr(r.error || "Upload failed.");
          break;
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const copy = async (id: string) => {
    const ok = await copyText(`/api/media/${id}`);
    if (ok) {
      setCopied(id);
      setTimeout(() => setCopied(""), 1400);
    }
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link
              key={k}
              href={k === "all" ? "/admin/media" : `/admin/media?kind=${k}`}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
                kind === k ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
              }`}
            >
              {k.replace("_", " ")}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
            onChange={(e) => upload(e.target.files)}
            className="hidden"
            id="media-upload"
          />
          <label htmlFor="media-upload">
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-500">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload images
            </span>
          </label>
        </div>
      </Toolbar>

      {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

      <label
        htmlFor="media-upload"
        className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] py-6 text-[12px] muted transition-colors hover:border-brand-500/50 hover:text-brand-400"
      >
        <ImagePlus size={15} /> Drop files here or click to upload — stored directly in the database
      </label>

      {rows.length === 0 ? (
        <Empty title="No images yet" sub="Upload your first image to get started." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="overflow-hidden rounded-xl panel"
            >
              <div className="relative aspect-square soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${m.id}`} alt={m.name} className="h-full w-full object-cover" />
                <span className="absolute left-1.5 top-1.5">
                  <Tag tone="slate">{m.kind.replace("_", " ")}</Tag>
                </span>
              </div>
              <div className="p-2">
                <div className="truncate text-[11px] font-semibold">{m.name}</div>
                <div className="text-[9.5px] muted">
                  {(m.size / 1024).toFixed(0)} KB · <LocalTime at={m.created_at} />
                </div>
                <div className="mt-1.5 flex gap-1">
                  <IconAction title="Copy URL" onClick={() => copy(m.id)}>
                    {copied === m.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </IconAction>
                  <IconAction title="Use as game icon" onClick={() => setAssign(m)}>
                    <Gamepad2 size={11} />
                  </IconAction>
                  <IconAction
                    title="Delete" danger disabled={busy}
                    onClick={() => {
                      if (!confirm(`Delete ${m.name}? Anything using it will lose its image.`)) return;
                      start(async () => {
                        await deleteMediaAction(m.id);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 size={11} />
                  </IconAction>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {assign && <AssignModal m={assign} games={games} onClose={() => setAssign(null)} />}
      </AnimatePresence>
    </div>
  );
}

function AssignModal({ m, games, onClose }: { m: M; games: G[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const list = q
    ? games.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
    : games.slice(0, 40);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-[440px] overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${m.id}`} alt="" className="h-9 w-9 rounded-lg object-cover" />
          <h2 className="text-[15px] font-black">Set as game icon</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>

        <input
          className={inputCls}
          placeholder="Search games…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="mt-2 space-y-1">
          {list.map((g) => (
            <button
              key={g.slug}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await setGameIconAction(g.slug, `/api/media/${m.id}`);
                  onClose();
                  router.refresh();
                })
              }
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-600/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.logo} alt="" className="h-7 w-7 rounded object-cover soft" />
              <span className="flex-1 truncate text-[12px] font-medium">{g.name}</span>
              {pending && <Loader2 size={12} className="animate-spin muted" />}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
