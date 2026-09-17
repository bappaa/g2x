"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Loader2, GripVertical } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { saveGameOfferFieldAction, deleteGameOfferFieldAction } from "@/lib/actions/admin";

type GF = {
  id: string; game_slug: string; field_key: string; label: string;
  field_type: string; options: string | null;
  parent_field: string | null; parent_value: string | null;
  sort_order: number; required: number;
};

function parseOptions(opts: string | null): string {
  if (!opts) return "";
  try {
    const v = JSON.parse(opts);
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  } catch {
    return opts;
  }
}

export default function GameOfferFieldsEditor({
  gameSlug,
  initialFields,
}: {
  gameSlug: string;
  initialFields: GF[];
}) {
  const router = useRouter();
  const [fields, setFields] = useState<GF[]>(initialFields);
  const [edit, setEdit] = useState<GF | "new" | null>(null);
  const [, start] = useTransition();

  const remove = (f: GF) => {
    if (!confirm(`Remove field "${f.label}"? This will affect seller offer creation for ${gameSlug}.`)) return;
    start(async () => {
      const r = await deleteGameOfferFieldAction(f.id);
      if (!r.ok) return alert(r.error);
      setFields((prev) => prev.filter((x) => x.id !== f.id));
      router.refresh();
    });
  };

  return (
    <div className="mt-6 rounded-xl border border-[var(--line)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold">Offer Details Fields (cascading dropdowns)</h3>
        <Btn type="button" className="flex items-center gap-1.5 text-[11px]" onClick={() => setEdit("new")}>
          <Plus size={12} /> Add field
        </Btn>
      </div>
      <p className="mb-3 text-[11px] muted">
        Configure Region → Realm → Faction etc. Each field can depend on parent field value.
        Example: Region options &quot;NA Season of Discovery, EU...&quot;, Realm parent_field=region parent_value=&quot;NA Season of Discovery&quot; options &quot;Penance, Faerlina...&quot;
        Sellers will see cascading dropdowns in order.
      </p>

      {fields.length === 0 ? (
        <div className="rounded-lg soft p-3 text-center text-[11px] muted">No custom fields yet. Add Region first.</div>
      ) : (
        <div className="space-y-2">
          {fields
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg soft p-2.5">
                <GripVertical size={12} className="muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold">{f.label}</span>
                    <span className="rounded bg-brand-600/20 px-1 py-0.5 text-[9px] text-brand-400">{f.field_key}</span>
                    {f.parent_field && (
                      <span className="text-[10px] muted">
                        if {f.parent_field} = {f.parent_value || "any"}
                      </span>
                    )}
                    {f.required ? <span className="text-[9px] text-rose-400">*required</span> : null}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[10.5px] muted">
                    {parseOptions(f.options).slice(0, 120)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEdit(f)}
                  className="grid h-7 w-7 place-items-center rounded-lg soft hover:text-brand-400"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="grid h-7 w-7 place-items-center rounded-lg soft hover:text-rose-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
        </div>
      )}

      {edit && (
        <FieldForm
          gameSlug={gameSlug}
          field={edit === "new" ? null : edit}
          existingKeys={fields.map((f) => f.field_key)}
          onClose={() => setEdit(null)}
          onSaved={(saved) => {
            if (edit === "new") setFields((p) => [...p, saved]);
            else setFields((p) => p.map((x) => (x.id === saved.id ? saved : x)));
            setEdit(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FieldForm({
  gameSlug,
  field,
  existingKeys,
  onClose,
  onSaved,
}: {
  gameSlug: string;
  field: GF | null;
  existingKeys: string[];
  onClose: () => void;
  onSaved: (f: GF) => void;
}) {
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveGameOfferFieldAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save");
      // build saved object from form for immediate UI
      const id = String(fd.get("id") || r.id || "");
      const saved: GF = {
        id,
        game_slug: gameSlug,
        field_key: String(fd.get("fieldKey") || "").trim().replace(/-/g, "_"),
        label: String(fd.get("label") || "").trim(),
        field_type: String(fd.get("fieldType") || "dropdown"),
        options: String(fd.get("options") || ""),
        parent_field: String(fd.get("parentField") || "").trim() || null,
        parent_value: String(fd.get("parentValue") || "").trim() || null,
        sort_order: Number(fd.get("sortOrder") || 0),
        required: fd.get("required") ? 1 : 0,
      };
      // try to keep options as JSON string as saved
      try {
        const raw = String(fd.get("options") || "").trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            saved.options = JSON.stringify(parsed);
          } catch {
            const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
            saved.options = JSON.stringify(arr);
          }
        }
      } catch {}
      onSaved(saved);
    });

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] space-y-3 rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h4 className="text-[14px] font-bold">{field ? "Edit field" : "Add field"}</h4>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={14} />
          </button>
        </div>

        <input type="hidden" name="id" value={field?.id || ""} />
        <input type="hidden" name="gameSlug" value={gameSlug} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label" hint="Shown to seller, e.g. Region, Realm, Faction">
            <input name="label" required defaultValue={field?.label || ""} className={inputCls} placeholder="Region" />
          </Field>
          <Field label="Field key" hint="Unique per game, e.g. region, realm, faction">
            <input
              name="fieldKey"
              required
              defaultValue={field?.field_key || ""}
              className={inputCls}
              placeholder="region"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select name="fieldType" defaultValue={field?.field_type || "dropdown"} className={inputCls}>
              <option value="dropdown">Dropdown</option>
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={field?.sort_order ?? 0} className={inputCls} />
          </Field>
        </div>

        <Field
          label="Options"
          hint='For dropdown: comma separated "NA Season of Discovery, EU..." or JSON array or JSON object mapping parent value to array: {"NA Season of Discovery": ["Penance", "Faerlina"]}'
        >
          <textarea
            name="options"
            rows={4}
            defaultValue={parseOptions(field?.options || null)}
            className={`${inputCls} h-auto py-2`}
            placeholder="NA Season of Discovery, EU Season of Discovery"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Parent field (optional)" hint="e.g. region — this field shows only when parent has value">
            <input
              name="parentField"
              defaultValue={field?.parent_field || ""}
              className={inputCls}
              placeholder="region"
              list="existing-keys"
            />
            <datalist id="existing-keys">
              {existingKeys.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
          <Field label="Parent value (optional)" hint="e.g. NA Season of Discovery — only show when parent equals this">
            <input name="parentValue" defaultValue={field?.parent_value || ""} className={inputCls} placeholder="NA Season of Discovery" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[12px]">
          <input type="checkbox" name="required" defaultChecked={field ? !!field.required : true} className="accent-[#8b3dff]" />
          Required
        </label>

        {err && <div className="text-[11px] text-rose-400">{err}</div>}

        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={12} className="animate-spin" />} Save field
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </form>
    </div>
  );
}
