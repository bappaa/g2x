"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, X, Loader2, Shield, UserPlus, UserMinus, Search } from "lucide-react";
import { Btn, Tag, Field, inputCls } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { saveRoleAction, assignAdminAction, revokeAdminAction, searchUsersAction } from "@/lib/actions/admin";

type R = { id: string; name: string; permissions: string; members: number };
type A = { id: string; name: string; email: string; role_name: string | null; role_id: string | null };
type P = { key: string; label: string };

const parse = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

export default function RolesManager({ roles, admins, permissions }: { roles: R[]; admins: A[]; permissions: P[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<R | "new" | null>(null);
  const [invite, setInvite] = useState(false);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Toolbar>
          <h3 className="text-[14px] font-bold">Roles</h3>
          <div className="ml-auto">
            <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
              <Plus size={13} /> New role
            </Btn>
          </div>
        </Toolbar>
        <Table head={["Role", "Permissions", "Members", ""]}>
          {roles.map((r) => {
            const perms = parse(r.permissions);
            const all = perms.includes("*") || perms.length >= permissions.length;
            return (
              <Tr key={r.id}>
                <Td>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Shield size={12} className="text-brand-400" /> {r.name}
                  </span>
                </Td>
                <Td>
                  {all ? (
                    <Tag tone="brand">Full access</Tag>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {perms.slice(0, 5).map((p) => (
                        <span key={p} className="rounded bg-brand-600/12 px-1.5 py-0.5 text-[9.5px] text-brand-400">{p}</span>
                      ))}
                      {perms.length > 5 && <span className="text-[9.5px] muted">+{perms.length - 5}</span>}
                    </div>
                  )}
                </Td>
                <Td className="muted">{r.members}</Td>
                <Td>
                  <div className="flex justify-end">
                    <IconAction title="Edit" onClick={() => setEdit(r)}><Pencil size={12} /></IconAction>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </Table>
      </div>

      <div className="space-y-3">
        <Toolbar>
          <h3 className="text-[14px] font-bold">Admin accounts</h3>
          <div className="ml-auto">
            <Btn variant="ghost" className="flex items-center gap-1.5" onClick={() => setInvite(true)}>
              <UserPlus size={13} /> Grant admin access
            </Btn>
          </div>
        </Toolbar>
        <Table head={["Name", "Email", "Role", ""]}>
          {admins.map((a) => (
            <Tr key={a.id}>
              <Td className="font-semibold">{a.name}</Td>
              <Td className="muted">{a.email}</Td>
              <Td><Tag tone="brand">{a.role_name ?? "Super Admin"}</Tag></Td>
              <Td>
                <div className="flex justify-end">
                  <IconAction
                    title="Revoke access" danger disabled={busy}
                    onClick={() => {
                      if (!confirm(`Revoke admin access for ${a.email}?`)) return;
                      start(async () => {
                        const r = await revokeAdminAction(a.id);
                        if (!r.ok) alert(r.error);
                        router.refresh();
                      });
                    }}
                  >
                    <UserMinus size={12} />
                  </IconAction>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      </div>

      <AnimatePresence>
        {edit && (
          <RoleForm r={edit === "new" ? null : edit} permissions={permissions} onClose={() => setEdit(null)} />
        )}
        {invite && <InviteForm roles={roles} onClose={() => setInvite(false)} />}
      </AnimatePresence>
    </div>
  );
}

function RoleForm({ r, permissions, onClose }: { r: R | null; permissions: P[]; onClose: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(r ? parse(r.permissions) : ["dashboard"]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      picked.forEach((p) => fd.append("permissions", p));
      const res = await saveRoleAction(fd);
      if (!res.ok) return setErr(res.error || "Could not save.");
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
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] space-y-3 overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{r ? "Edit role" : "New role"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="id" value={r?.id ?? ""} />
        <Field label="Role name">
          <input name="name" required defaultValue={r?.name} className={inputCls} placeholder="Finance Manager" />
        </Field>
        <Field label="Permissions">
          <div className="space-y-1 rounded-xl soft p-3">
            {permissions.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={picked.includes(p.key) || picked.includes("*")}
                  onChange={(e) =>
                    setPicked((s) => (e.target.checked ? Array.from(new Set([...s, p.key])) : s.filter((x) => x !== p.key && x !== "*")))
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
        </Field>
        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save role
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}

function InviteForm({ roles, onClose }: { roles: R[]; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  // ---- typeahead ----
  const [hits, setHits] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = email.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const rows = await searchUsersAction(term);
        if (!cancelled) {
          setHits(rows);
          setOpen(true);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [email]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">Grant admin access</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>

        <div ref={boxRef} className="relative">
          <Field label="Search an existing user" hint="Start typing a name or email">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 muted" />
              <input
                className={`${inputCls} pl-8`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => hits.length && setOpen(true)}
                placeholder="name@g2x.gg"
                autoComplete="off"
              />
              {searching && (
                <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin muted" />
              )}
            </div>
          </Field>

          <AnimatePresence>
            {open && hits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-2xl"
              >
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setEmail(h.email);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-600/10"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600/20 text-[10px] font-bold text-brand-400">
                      {h.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{h.name}</span>
                      <span className="block truncate text-[10px] muted">{h.email}</span>
                    </span>
                    {h.role === "admin" && <Tag tone="brand">Admin</Tag>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {email.trim().length >= 2 && !searching && hits.length === 0 && (
            <p className="mt-1 text-[10.5px] muted">No user matches — they must register first.</p>
          )}
        </div>

        <Field label="Role">
          <select className={inputCls} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn
            className="flex items-center gap-2"
            disabled={pending || !email}
            onClick={() =>
              start(async () => {
                setErr("");
                const r = await assignAdminAction(email, roleId);
                if (!r.ok) return setErr(r.error || "Could not grant access.");
                onClose();
                router.refresh();
              })
            }
          >
            {pending && <Loader2 size={13} className="animate-spin" />} Grant access
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
