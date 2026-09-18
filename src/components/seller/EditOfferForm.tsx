"use client";
import { useRef, useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useMoney } from "@/components/LocaleProvider";
import { updateOfferFullAction } from "@/lib/actions/seller";
import { getPreset } from "@/lib/category-delivery";

type SellConfig = {
  slug: string; name: string; unit_label: string | null;
  needs_title: number; needs_images: number; needs_credentials: number;
  needs_quantity: number; allow_volume_discount: number;
  commission_pct?: number | null;
  sell_notice_title: string | null; sell_notice: string | null;
  fulfilment?: string;
  show_delivery_method?: number;
  show_region?: number;
  show_platform?: number;
  show_login_method?: number;
};
type FieldTpl = {
  id: string; label: string; field_key: string; field_type: string;
  options: string | null; required: number;
};
type Opt = { value: string; label: string };
type AccountSet = {
  login: string; password: string; url: string;
  emailLogin: string; emailPassword: string;
  twoFaLogin: string; twoFaPassword: string;
  extra: string;
};

const emptyAccount = (): AccountSet => ({
  login: "", password: "", url: "", emailLogin: "", emailPassword: "",
  twoFaLogin: "", twoFaPassword: "", extra: "",
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl panel p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13.5px] font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-lg soft px-3 py-2 text-[11px] leading-relaxed muted">{children}</div>;
}
function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11.5px] font-semibold">
      {children}
      {req && <span className="ml-1 text-rose-400">*</span>}
    </label>
  );
}
const fieldCls =
  "h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-[12.5px] outline-none transition-all focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(139,61,255,.12)] soft";

async function downscale(file: File, max = 1280, quality = 0.82): Promise<string> {
  const asDataUrl = () =>
    new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
  if (file.type === "image/gif") return asDataUrl();
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return asDataUrl();
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL("image/webp", quality);
  } catch {
    return asDataUrl();
  }
}

type OfferRow = {
  id: string;
  title: string | null;
  description: string | null;
  price: number;
  stock: number;
  min_qty: number | null;
  delivery_time: string | null;
  delivery_method: string | null;
  region: string | null;
  platform: string | null;
  login_method: string | null;
  instructions: string | null;
  auto_delivery: number | null;
  images: string | null;
  volume_discounts: string | null;
  accounts_data: string | null;
  custom_fields: string | null;
};

type GameField = { id: string; game_slug: string; field_key: string; label: string; field_type: string; options: string | null; parent_field: string | null; parent_value: string | null; sort_order: number; required: number };
export default function EditOfferForm({
  offer,
  config,
  product,
  fields,
  regions,
  platforms,
  deliveryMethods,
  deliveryTimes,
  loginMethods,
  gameFields = [],
  gameSlug: _gameSlug = "",
}: {
  offer: OfferRow;
  config: SellConfig;
  product: { id: string; name: string; image: string; base_price: number };
  fields: FieldTpl[];
  regions: Opt[];
  platforms: Opt[];
  deliveryMethods: Opt[];
  deliveryTimes: Opt[];
  loginMethods: Opt[];
  gameFields?: GameField[];
  gameSlug?: string;
}) {
  const router = useRouter();
  const money = useMoney();
  void _gameSlug;
  void loginMethods;
  void regions;
  void platforms;
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const picker = useRef<HTMLInputElement>(null);

  const preset = useMemo(() => getPreset(config.slug), [config.slug]);
  const unit = config.unit_label || preset?.unitLabel || "unit";
  const mode = preset?.fulfilment || config.fulfilment || "both";
  const isGiftCard = config.slug === "gift-cards";
  const vaultNoun = isGiftCard ? "Gift Card" : "Account";

  let existingImages: string[] = [];
  try { existingImages = JSON.parse(offer.images || "[]"); } catch {}
  let existingVolume: { qty: number; pct: number }[] = [];
  try { existingVolume = JSON.parse(offer.volume_discounts || "[]"); } catch {}
  let existingAccounts: AccountSet[] = [];
  try { 
    const acc = JSON.parse(offer.accounts_data || "[]");
    if (Array.isArray(acc) && acc.length) existingAccounts = acc;
  } catch {}
  let existingCustom: Record<string, string> = {};
  try { existingCustom = JSON.parse(offer.custom_fields || "{}"); } catch {}

  const [title, setTitle] = useState(offer.title || product.name);
  const [description, setDescription] = useState(offer.description || "");
  const [images, setImages] = useState<{ name: string; data: string }[]>(
    existingImages.map((d, i) => ({ name: `image-${i}`, data: d }))
  );
  const [price, setPrice] = useState(String(offer.price ?? ""));
  const [stock, setStock] = useState(String(offer.stock ?? "1"));
  const [minQty, setMinQty] = useState(String(offer.min_qty ?? "1"));
  const [deliveryTime, setDeliveryTime] = useState(offer.delivery_time || "");

  const effectiveDeliveryMethods = useMemo(() => {
    if (preset) {
      if (preset.showDeliveryMethods) {
        return preset.deliveryMethods.map(m => ({ value: m.value, label: m.label, beta: m.beta }));
      }
      return [];
    }
    if (config.show_delivery_method === 0) return [];
    return deliveryMethods;
  }, [preset, deliveryMethods, config.show_delivery_method]);

  const [deliveryMethod, setDeliveryMethod] = useState(offer.delivery_method || (preset?.slug === "boosting" ? "boosting_service" : (effectiveDeliveryMethods[0]?.value || deliveryMethods[0]?.value || "")));
  useEffect(() => {
    if (preset?.slug === "boosting" && deliveryMethod !== "boosting_service") {
      setDeliveryMethod("boosting_service");
      return;
    }
    if (effectiveDeliveryMethods.length === 1 && deliveryMethod !== effectiveDeliveryMethods[0].value) {
      setDeliveryMethod(effectiveDeliveryMethods[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDeliveryMethods, preset?.slug]);

  const [region, setRegion] = useState(offer.region || "");
  const [platform, setPlatform] = useState(offer.platform || "");
  const loginMethod = offer.login_method || "";
  void loginMethods;
  const [auto, setAuto] = useState(offer.auto_delivery ? !!offer.auto_delivery : mode !== "manual");
  const [instructions, setInstructions] = useState(offer.instructions || "");
  const initialGameVals: Record<string, string> = {};
  const initialCustom: Record<string, string> = {};
  for (const [k,v] of Object.entries(existingCustom)) {
    if (gameFields.some(gf=>gf.field_key===k)) initialGameVals[k]=v;
    else initialCustom[k]=v;
  }
  const [custom, setCustom] = useState<Record<string, string>>(initialCustom);
  const [gameVals, setGameVals] = useState<Record<string, string>>(initialGameVals);
  const [volume, setVolume] = useState<{ qty: string; pct: string }[]>(
    existingVolume.length ? existingVolume.map(v => ({ qty: String(v.qty), pct: String(v.pct) })) : [{ qty: "", pct: "" }]
  );
  const [accounts, setAccounts] = useState<AccountSet[]>(existingAccounts.length ? existingAccounts : [emptyAccount()]);
  const [agreeTos, setAgreeTos] = useState(true);
  const [agreeRules, setAgreeRules] = useState(true);
  const [err, setErr] = useState("");

  const priceNum = Number(price) || 0;

  const getGameFieldOptions = (f: GameField): string[] => {
    if (!f.options) return [];
    try {
      const parsed = JSON.parse(f.options) as unknown;
      if (Array.isArray(parsed)) return (parsed as unknown[]).map(String);
      if (typeof parsed === "object" && parsed !== null) {
        const rec = parsed as Record<string, unknown>;
        if (f.parent_field) {
          const parentVal = gameVals[f.parent_field] || (f.parent_field === "region" ? region : f.parent_field === "platform" ? platform : "");
          if (parentVal && rec[parentVal] !== undefined) {
            const v = rec[parentVal];
            return Array.isArray(v) ? (v as unknown[]).map(String) : [String(v as string)];
          }
          if (f.parent_value && rec[f.parent_value] !== undefined) {
            const v = rec[f.parent_value];
            return Array.isArray(v) ? (v as unknown[]).map(String) : [String(v as string)];
          }
          return [];
        }
        return Object.keys(rec);
      }
      return [];
    } catch {
      return f.options.split(",").map((x) => x.trim()).filter(Boolean);
    }
  };
  const isGameFieldVisible = (f: GameField): boolean => {
    if (!f.parent_field) return true;
    const parentVal = gameVals[f.parent_field] || (f.parent_field === "region" ? region : f.parent_field === "platform" ? platform : "");
    if (!parentVal) return false;
    if (f.parent_value && parentVal !== f.parent_value) return false;
    return true;
  };
  const setGameVal = (key: string, val: string) => {
    setGameVals((prev) => {
      const next = { ...prev, [key]: val };
      const toClear: string[] = [];
      const findChildren = (parentKey: string) => {
        for (const gf of gameFields) {
          if (gf.parent_field === parentKey) {
            toClear.push(gf.field_key);
            findChildren(gf.field_key);
          }
        }
      };
      findChildren(key);
      for (const c of toClear) delete next[c];
      return next;
    });
    if (key === "region") setRegion(val);
    if (key === "platform") setPlatform(val);
  };

  const setAcc = (i: number, k: keyof AccountSet, v: string) =>
    setAccounts((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const next: { name: string; data: string }[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      if (f.size > 2 * 1024 * 1024) {
        setErr(`${f.name} is larger than 2 MB.`);
        continue;
      }
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
        setErr(`${f.name} must be PNG, JPEG, WEBP or GIF.`);
        continue;
      }
      next.push({ name: f.name, data: await downscale(f) });
    }
    setImages((p) => [...p, ...next].slice(0, 6));
  };

  const submit = () => {
    if (busy.current) return;
    setErr("");
    if ((config.needs_title || !product.id) && !title.trim()) return setErr("Offer title is required.");
    if (!(priceNum > 0)) return setErr("Enter a price greater than 0.");
    const needTime = preset ? (preset.showGuaranteedTime === true ? true : preset.showGuaranteedTime === "manual_only" ? !auto : false) : !auto;
    if (needTime && !deliveryTime) return setErr("Guaranteed delivery time is required.");
    if (config.needs_credentials && auto && mode !== "manual") {
      const bad = accounts.findIndex((a) =>
        isGiftCard ? !a.login.trim() : !a.login.trim() || !a.password.trim()
      );
      if (bad >= 0)
        return setErr(
          isGiftCard
            ? `Gift Card #${bad + 1} needs a code.`
            : `Account #${bad + 1} needs a login and password.`
        );
    }
    for (const f of fields) {
      if (f.required && !String(custom[f.field_key] ?? "").trim())
        return setErr(`${f.label} is required.`);
    }
    for (const gf of gameFields) {
      if (!isGameFieldVisible(gf)) continue;
      if (gf.required && !String(gameVals[gf.field_key] ?? "").trim()) {
        if (gf.field_key === "region" && region) continue;
        return setErr(`${gf.label} is required.`);
      }
    }
    if (!agreeTos || !agreeRules) return setErr("Please accept the Terms and Rules.");

    busy.current = true;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("id", offer.id);
        fd.set("title", title.trim() || product.name);
        fd.set("description", description.trim());
        fd.set("price", String(priceNum));
        fd.set("stock", stock);
        fd.set("minQty", minQty);
        fd.set("deliveryTime", auto ? deliveryTime || "Instant" : deliveryTime);
        fd.set("deliveryMethod", deliveryMethod);
        fd.set("region", region);
        fd.set("platform", platform);
        fd.set("loginMethod", loginMethod);
        fd.set("instructions", instructions.trim());
        fd.set("autoDelivery", auto ? "1" : "0");
        fd.set("images", JSON.stringify(images.map((i) => i.data)));
        fd.set(
          "volumeDiscounts",
          JSON.stringify(
            volume
              .filter((v) => Number(v.qty) > 0 && Number(v.pct) > 0)
              .map((v) => ({ qty: Number(v.qty), pct: Number(v.pct) }))
          )
        );
        if (config.needs_credentials) fd.set("accounts", JSON.stringify(accounts));
        Object.entries(custom).forEach(([k, v]) => fd.set("cf_" + k, v));
        Object.entries(gameVals).forEach(([k, v]) => fd.set("cf_" + k, v));
        if (gameVals["region"]) fd.set("region", gameVals["region"]);
        if (gameVals["platform"]) fd.set("platform", gameVals["platform"]);

        const r = await updateOfferFullAction(fd).catch(() => null);
        if (!r || !r.ok) {
          setErr(r?.error || "Could not update the offer.");
          return;
        }
        router.push("/seller/offers");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  const showTime = preset ? (preset.showGuaranteedTime === true ? true : preset.showGuaranteedTime === "manual_only" ? !auto : false) : !auto;
  const quantityMode = preset?.quantityMode || (config.needs_quantity ? "full" : "hidden");

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <div className="rounded-2xl panel p-4">
        <h1 className="text-[18px] font-black">Edit Offer</h1>
        <p className="mt-1 text-[12px] muted">Update your offer details. Click Save changes when done.</p>
      </div>

      {(config.needs_title === 1 || !product.id) && (
        <Card title="Offer Title">
          <div className="mb-1 text-right text-[10.5px] muted">{title.length}/160</div>
          <input
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Type here…"
            className={fieldCls}
          />
        </Card>
      )}

      {fields.length > 0 && (
        <Card title="Offer Details">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const opts = (() => {
                try {
                  const v = JSON.parse(f.options ?? "[]");
                  return Array.isArray(v) ? v.map(String) : [];
                } catch {
                  return String(f.options ?? "").split(",").map((x) => x.trim()).filter(Boolean);
                }
              })();
              return (
                <div key={f.id} className={f.field_type === "textarea" ? "sm:col-span-2" : ""}>
                  <Label req={!!f.required}>{f.label}</Label>
                  {f.field_type === "switch" || f.field_type === "boolean" ? (
                    <select
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      className={fieldCls}
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : f.field_type === "dropdown" && opts.length ? (
                    <select
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      className={fieldCls}
                    >
                      <option value="">Select</option>
                      {opts.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.field_type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      placeholder="Type here…"
                      className={`${fieldCls} h-auto py-2`}
                    />
                  ) : (
                    <input
                      type={f.field_type === "number" ? "number" : "text"}
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      placeholder="Type here…"
                      className={fieldCls}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {config.needs_images === 1 && (
        <Card title="Offer photos">
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((im, i) => (
              <span key={i} className="relative h-20 w-20 overflow-hidden rounded-lg soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.data} alt={im.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {images.length < 6 && (
              <button
                type="button"
                onClick={() => picker.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-[var(--line)] muted transition-colors hover:border-brand-500 hover:text-brand-400"
              >
                <Upload size={16} />
              </button>
            )}
          </div>
          <input
            ref={picker}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => addImages(e.target.files)}
          />
        </Card>
      )}

      <Card title="Description (Optional)">
        <div className="mb-1 text-right text-[10.5px] muted">{description.length}/2000</div>
        <textarea
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Type here…"
          className={`${fieldCls} h-auto py-2`}
        />
      </Card>

      <Card title="Delivery">
        {mode === "both" && (
          <div className="mb-4">
            <Label>Delivery method</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { v: true, l: "Automatic", d: "G2X instantly delivers after payment." },
                { v: false, l: "Manual", d: "You send details via chat after sale." },
              ].map((o) => (
                <label key={o.l} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 transition-all ${auto===o.v ? "border-brand-500 bg-brand-600/10" : "border-[var(--line)] soft hover:border-brand-500/50"}`}>
                  <input type="radio" checked={auto === o.v} onChange={() => setAuto(o.v)} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
                  <span className="min-w-0"><span className="block text-[12.5px] font-bold">{o.l}</span><span className="mt-0.5 block text-[11px] muted">{o.d}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}

        {showTime && (
          <div className="mb-4">
            <Label req>Guaranteed Delivery Time</Label>
            <div className="relative">
              <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 pr-9 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
                <option value="">Choose</option>
                {deliveryTimes.map((d) => (
                  <option key={d.value} value={d.label}>{d.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 muted">▼</span>
            </div>
          </div>
        )}

        {effectiveDeliveryMethods.length > 0 && (
          <div className="mb-4">
            {preset?.slug === "currency" ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Label>Delivery method</Label>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">BETA</span>
                </div>
                <div className="grid gap-2">
                  {effectiveDeliveryMethods.map((d) => (
                    <label key={d.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium transition-all ${deliveryMethod===d.value ? "border-brand-500 bg-brand-600/10" : "border-[var(--line)] soft hover:border-brand-500/50"}`}>
                      <input type="radio" name="dm" checked={deliveryMethod === d.value} onChange={() => setDeliveryMethod(d.value)} className="accent-[var(--brand,#8b3dff)]" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </>
            ) : preset?.singleFixed ? (
              <>
                <Label>Delivery method</Label>
                <div className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 px-3.5 text-[13px] leading-[44px]">
                  {effectiveDeliveryMethods[0]?.label || "In-game delivery"}
                </div>
              </>
            ) : (
              <>
                <Label>How will you deliver?</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {effectiveDeliveryMethods.map((d) => (
                    <label key={d.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium transition-all ${deliveryMethod===d.value ? "border-brand-500 bg-brand-600/10" : "border-[var(--line)] soft hover:border-brand-500/50"}`}>
                      <input type="radio" name="dm" checked={deliveryMethod === d.value} onChange={() => setDeliveryMethod(d.value)} className="accent-[var(--brand,#8b3dff)]" />
                      {d.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {(() => {
          const clean = gameFields.filter(f=>!/ede/i.test(f.field_key) && !/ede/i.test(f.label) && f.field_key!=='gg' && f.label!=='gg' && f.field_key.length>=2 && !/^aa$/i.test(f.field_key) && !/^aa$/i.test(f.label));
          const filtered = clean.filter(f=>{ 
            if (/^india$/i.test(f.field_key) && f.options && /delhi.*aa.*bb/i.test(f.options)) return false;
            if (/^abc$/i.test(f.field_key)) return false;
            return true;
          });
          const remaining = filtered.slice().sort((a,b)=>a.sort_order-b.sort_order).filter(gf=>isGameFieldVisible(gf));
          if (remaining.length===0) return null;
          return (
            <div className="mb-2 grid gap-3.5 sm:grid-cols-2">
              {remaining.map((gf) => {
                const opts = getGameFieldOptions(gf);
                if (opts.length===0 && gf.field_type==="dropdown") return null;
                return (
                  <div key={gf.id}>
                    <Label req={!!gf.required}>{gf.label}</Label>
                    {gf.field_type === "dropdown" ? (
                      <div className="relative">
                        <select value={gameVals[gf.field_key] ?? (gf.field_key === "region" ? region : "")} onChange={(e) => setGameVal(gf.field_key, e.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 pr-9 text-[13px] font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
                          <option value="">Select {gf.label}</option>
                          {opts.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] muted">▼</span>
                      </div>
                    ) : (
                      <input value={gameVals[gf.field_key] ?? ""} onChange={(e) => setGameVal(gf.field_key, e.target.value)} placeholder={`Enter ${gf.label}`} className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        </Card>

      {config.needs_credentials === 1 && (
        <Card title={`${vaultNoun} information`}>
          <div className="space-y-4">
            {accounts.map((a, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-600/15 px-3 py-2">
                  <span className="text-[12.5px] font-bold text-brand-300">{vaultNoun} #{i + 1}</span>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAccounts((p) => p.filter((_, j) => j !== i))}
                      className="muted transition-colors hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {isGiftCard ? (
                  <>
                    <div className="mb-1 text-[11.5px] font-bold">Gift card code <span className="muted">(Required)</span></div>
                    <input value={a.login} onChange={(e) => setAcc(i, "login", e.target.value)} placeholder="Type the code here…" className={fieldCls} />
                  </>
                ) : (
                  <>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div><Label>Login / Username</Label><input value={a.login} onChange={(e) => setAcc(i, "login", e.target.value)} placeholder="Type here…" className={fieldCls} /></div>
                      <div><Label>Password</Label><input value={a.password} onChange={(e) => setAcc(i, "password", e.target.value)} placeholder="Type here…" className={fieldCls} /></div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAccounts((p) => [...p, { login: "", password: "", url: "", emailLogin: "", emailPassword: "", twoFaLogin: "", twoFaPassword: "", extra: "" }])}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-brand-400"
          >
            <Plus size={13} /> ADD ADDITIONAL {vaultNoun.toUpperCase()}
          </button>
        </Card>
      )}

      {!auto && (
        <Card title="Manual delivery">
          <Hint>You will receive the order in your seller panel and must send the account details to the buyer through G2X chat.</Hint>
          <div className="mt-3">
            <Label>Notes for the buyer (optional)</Label>
            <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Type here…" className={`${fieldCls} h-auto py-2`} />
          </div>
        </Card>
      )}

      {quantityMode === "full" && (
        <Card title="Quantity">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label req>Total Quantity available</Label>
              <div className="relative">
                <input type="number" min={1} value={stock} onChange={(e) => setStock(e.target.value)} className={`${fieldCls} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">K</span>
              </div>
            </div>
            <div>
              <Label>Minimum Offer quantity</Label>
              <div className="relative">
                <input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={`${fieldCls} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">K</span>
              </div>
            </div>
          </div>
        </Card>
      )}
      {quantityMode === "min_total" && (
        <Card title="Quantity">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label req>Total Quantity available</Label>
              <div className="relative">
                <input type="number" min={1} value={stock} onChange={(e) => setStock(e.target.value)} className={`${fieldCls} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">M</span>
              </div>
            </div>
            <div>
              <Label>Minimum Offer quantity</Label>
              <div className="relative">
                <input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={`${fieldCls} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">M</span>
              </div>
            </div>
          </div>
        </Card>
      )}
      {quantityMode === "fixed_1" && (
        <Card title="Quantity">
          <Label>Total Quantity available</Label>
          <div className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)]/50 px-3 text-[12.5px] leading-[40px]">1 unit</div>
        </Card>
      )}

      <Card title="Price">
        <Label req>Price per {unit}</Label>
        <div className="relative">
          <input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className={`${fieldCls} pr-20`} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold muted">$ USD</span>
        </div>
        {priceNum > 0 && (
          <div className="mt-2 text-[11.5px] font-semibold text-brand-400">
            Buyers see {money(priceNum)} per {unit}
          </div>
        )}
      </Card>

      {(config.allow_volume_discount === 1 && preset?.allowVolume) && (
        <Card title="Volume discount">
          <div className="space-y-2">
            {volume.map((v, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label>Minimum quantity for discount</Label>
                  <div className="relative">
                    <input type="number" min={0} value={v.qty} onChange={(e) => setVolume((p) => p.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="0" className={`${fieldCls} pr-14`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">K</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <Label>Discount percentage</Label>
                  <div className="relative">
                    <input type="number" min={0} max={90} value={v.pct} onChange={(e) => setVolume((p) => p.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} placeholder="0" className={`${fieldCls} pr-10`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">%</span>
                  </div>
                </div>
                <button type="button" onClick={() => setVolume((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))} className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg soft muted hover:text-rose-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVolume((p) => [...p, { qty: "", pct: "" }])} className="mt-2.5 rounded-lg soft px-3 py-1.5 text-[12px] font-semibold hover:bg-brand-600/10">
            + Add row
          </button>
        </Card>
      )}

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2 text-[12px]">
          <input type="checkbox" checked={agreeTos} onChange={(e) => setAgreeTos(e.target.checked)} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
          <span>I have read and agree to the <Link href="/p/terms" className="text-brand-400 hover:underline">Terms of Service</Link>.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[12px]">
          <input type="checkbox" checked={agreeRules} onChange={(e) => setAgreeRules(e.target.checked)} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
          <span>I have read and agree to the <Link href="/p/seller-rules" className="text-brand-400 hover:underline">Seller Rules</Link>.</span>
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-300">{err}</div>
      )}

      <div className="flex items-center gap-3 pb-6">
        <Link href="/seller/offers" className="rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold hover:bg-brand-600/10">Back</Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-[12.5px] font-bold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
