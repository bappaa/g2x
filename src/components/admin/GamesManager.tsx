"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Pencil, Trash2, X, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import ImagePicker from "@/components/admin/ImagePicker";
import { saveGameAction, deleteGameAction, toggleGameAction } from "@/lib/actions/admin";

type G = {
  slug: string; name: string; logo: string; accent: string; status: string;
  sort_order: number; categories: number; products: number; cat_slugs: string | null;
};
type C = { slug: string; name: string };

export default function GamesManager({
  games, categories, page = 1, perPage = 40, total = 0, query = "",
}: {
  games: G[]; categories: C[];
  page?: number; perPage?: number; total?: number; query?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [edit, setEdit] = useState<G | "new" | null>(null);
  const [busy, start] = useTransition();

  /**
   * The table is paginated server-side, so filtering the current page in the
   * browser would only ever search 40 of 169+ games. The query is pushed into
   * the URL (debounced) and the server returns the matching page instead.
   */
  const rows = games;
  useEffect(() => {
    if (q === query) return;
    const id = setTimeout(() => {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      router.push(`/admin/games${qs.toString() ? `?${qs}` : ""}`);
    }, 300);
    return () => clearTimeout(id);
  }, [q, query, router]);

  const remove = (g: G) => {
    if (!confirm(`Remove “${g.name}”? Its ${g.products} product(s) and all seller offers under them will be deleted.`))
      return;
    start(async () => {
      const r = await deleteGameAction(g.slug);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Search games…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="text-[11.5px] muted">{rows.length} games</span>
        <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
          <Plus size={13} /> Add game
        </Btn>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="No games found" sub="Try another search, or add a new game." />
      ) : (
        <Table head={["Game", "Slug", "Categories", "Products", "Status", ""]}>
          {rows.map((g) => (
            <Tr key={g.slug}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-black text-white"
                    style={{ background: g.accent || "#8b3dff" }}
                  >
                    {g.name.slice(0, 1)}
                  </span>
                  <span className="font-semibold">{g.name}</span>
                </div>
              </Td>
              <Td className="muted">{g.slug}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {(g.cat_slugs ?? "").split(",").filter(Boolean).slice(0, 3).map((c) => (
                    <span key={c} className="rounded bg-brand-600/12 px-1.5 py-0.5 text-[10px] capitalize text-brand-400">
                      {c.replace("-", " ")}
                    </span>
                  ))}
                  {g.categories > 3 && <span className="text-[10px] muted">+{g.categories - 3}</span>}
                </div>
              </Td>
              <Td className="muted">{g.products}</Td>
              <Td>
                <Tag tone={g.status === "active" ? "green" : "slate"}>
                  {g.status === "active" ? "Live" : "Hidden"}
                </Tag>
              </Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Link href={`/g/${g.slug}`} target="_blank">
                    <IconAction title="View on site"><ExternalLink size={12} /></IconAction>
                  </Link>
                  <IconAction
                    title={g.status === "active" ? "Hide" : "Publish"}
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        await toggleGameAction(g.slug, g.status === "active" ? "hidden" : "active");
                        router.refresh();
                      })
                    }
                  >
                    {g.status === "active" ? <EyeOff size={12} /> : <Eye size={12} />}
                  </IconAction>
                  <IconAction title="Edit" onClick={() => setEdit(g)}><Pencil size={12} /></IconAction>
                  <IconAction title="Remove" danger disabled={busy} onClick={() => remove(g)}>
                    <Trash2 size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {total > perPage && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11.5px] muted">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <GamePager to={page - 1} disabled={page <= 1} q={query} label="Previous" />
            <span className="text-[11.5px] muted">{page} / {Math.ceil(total / perPage)}</span>
            <GamePager
              to={page + 1}
              disabled={page >= Math.ceil(total / perPage)}
              q={query}
              label="Next"
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {edit && (
          <GameForm
            game={edit === "new" ? null : edit}
            categories={categories}
            onClose={() => setEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GameForm({ game, categories, onClose }: { game: G | null; categories: C[]; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>(
    (game?.cat_slugs ?? "").split(",").filter(Boolean)
  );

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      picked.forEach((c) => fd.append("categories", c));
      const r = await saveGameAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save.");
      onClose();
      router.refresh();
    });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.form
        action={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[560px] space-y-3 overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{game ? "Edit game" : "Add a game"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>

        <input type="hidden" name="original" value={game?.slug ?? ""} />

        <Field label="Game name">
          <input name="name" required defaultValue={game?.name} className={inputCls} placeholder="Valorant" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="URL slug" hint="Leave blank to generate from the name">
            <input name="slug" defaultValue={game?.slug} className={inputCls} placeholder="valorant" />
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={game?.sort_order ?? 0} className={inputCls} />
          </Field>
        </div>
        <ImagePicker
          label="Game icon / key art"
          urlName="logo"
          fileName="logoFile"
          defaultUrl={game?.logo ?? ""}
          square
          hint="Upload an icon and it is stored in the database — editable any time."
        />

        <Field label="Accent colour">
          <input name="accent" type="color" defaultValue={game?.accent || "#8b3dff"} className={`${inputCls} h-[38px] p-1`} />
        </Field>

        <Field label="Appears in these categories" hint="Controls which category pages list this game">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = picked.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.slug) : [...p, c.slug]))}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all ${
                    on ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Status">
          <select name="status" defaultValue={game?.status ?? "active"} className={inputCls}>
            <option value="active">Live on site</option>
            <option value="hidden">Hidden</option>
          </select>
        </Field>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}

        <div className="flex gap-2 pt-1">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save game
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}

/** Pager link that keeps the current search term. */
function GamePager({
  to, disabled, q, label,
}: {
  to: number; disabled: boolean; q: string; label: string;
}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (to > 1) qs.set("page", String(to));
  const href = `/admin/games${qs.toString() ? `?${qs}` : ""}`;

  if (disabled)
    return (
      <span className="cursor-not-allowed rounded-lg soft px-3 py-1.5 text-[12px] font-semibold opacity-40">
        {label}
      </span>
    );
  return (
    <Link
      href={href}
      className="rounded-lg soft px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-brand-600/10 hover:text-brand-400"
    >
      {label}
    </Link>
  );
}
