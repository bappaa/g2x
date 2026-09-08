"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Trash2, Upload, X, Lock, AlertTriangle } from "lucide-react";
import { useMoney } from "@/components/LocaleProvider";
import { createOfferAction } from "@/lib/actions/seller";

export type SellConfig = {
  slug: string; name: string; unit_label: string | null;
  needs_title: number; needs_images: number; needs_credentials: number;
  needs_quantity: number; allow_volume_discount: number;
  commission_pct: number | null;
  sell_notice_title: string | null; sell_notice: string | null;
};
export type FieldTpl = {
  id: string; label: string; field_key: string; field_type: string;
  options: string | null; required: number;
};
export type Opt = { value: string; label: string };
export type AccountSet = {
  login: string; password: string; url: string;
  emailLogin: string; emailPassword: string;
  twoFaLogin: string; twoFaPassword: string;
  extra: string;
};

const MAX_IMAGE = 2 * 1024 * 1024;
const emptyAccount = (): AccountSet => ({
  login: "", password: "", url: "", emailLogin: "", emailPassword: "",
  twoFaLogin: "", twoFaPassword: "", extra: "",
});

/* --- small presentational helpers, in our own design language --- */

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl panel p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13.5px] font-bold">{title}</h2>
        {badge && (
          <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-[9.5px] font-black text-brand-400">
            {badge}
          </span>
        )}
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

const field =
  "h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-[12.5px] outline-none transition-all focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(139,61,255,.12)] soft";

/**
 * THE OFFER FORM
 * ==============
 * One component drives every category. What it asks for is not hardcoded — it
 * comes from `categories` (does this category need a title? images? account
 * credentials? volume discounts? what is the unit called?) plus the admin's
 * `field_templates` rows for that category.
 *
 * So "Currency" shows quantity + price per K, "Accounts" shows the credential
 * vault and hides volume discounts, and adding a new requirement is an admin
 * action rather than a code change.
 */
export default function OfferForm({
  config, product, game, fields, regions, platforms, deliveryMethods, deliveryTimes, loginMethods,
}: {
  config: SellConfig;
  product: { id: string; name: string; image: string; base_price: number };
  game: string;
  fields: FieldTpl[];
  regions: Opt[];
  platforms: Opt[];
  deliveryMethods: Opt[];
  deliveryTimes: Opt[];
  loginMethods: Opt[];
}) {
  const router = useRouter();
  const money = useMoney();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const picker = useRef<HTMLInputElement>(null);

  const unit = config.unit_label || "unit";
  const commission = Number(config.commission_pct ?? 8);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [minQty, setMinQty] = useState("1");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(deliveryMethods[0]?.value ?? "");
  const [region, setRegion] = useState("");
  const [platform, setPlatform] = useState("");
  const [loginMethod, setLoginMethod] = useState("");
  const [auto, setAuto] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [volume, setVolume] = useState<{ qty: string; pct: string }[]>([{ qty: "", pct: "" }]);
  const [accounts, setAccounts] = useState<AccountSet[]>([emptyAccount()]);
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);
  const [err, setErr] = useState("");

  const priceNum = Number(price) || 0;
  const net = useMemo(() => priceNum * (1 - commission / 100), [priceNum, commission]);

  const setAcc = (i: number, k: keyof AccountSet, v: string) =>
    setAccounts((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const next: { name: string; data: string }[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      if (f.size > MAX_IMAGE) {
        setErr(`${f.name} is larger than 2 MB.`);
        continue;
      }
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
        setErr(`${f.name} must be PNG, JPEG, WEBP or GIF.`);
        continue;
      }
      next.push({
        name: f.name,
        data: await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.readAsDataURL(f);
        }),
      });
    }
    setImages((p) => [...p, ...next].slice(0, 6));
  };

  const submit = () => {
    if (busy.current) return;
    setErr("");

    if ((config.needs_title || !product.id) && !title.trim())
      return setErr("Offer title is required.");
    if (!(priceNum > 0)) return setErr("Enter a price greater than 0.");
    if (!deliveryTime) return setErr("Guaranteed delivery time is required.");
    if (config.needs_credentials && auto) {
      const bad = accounts.findIndex((a) => !a.login.trim() || !a.password.trim());
      if (bad >= 0) return setErr(`Account #${bad + 1} needs a login and password.`);
    }
    for (const f of fields) {
      if (f.required && !String(custom[f.field_key] ?? "").trim())
        return setErr(`${f.label} is required.`);
    }
    if (!agreeTos || !agreeRules) return setErr("Please accept the Terms of Service and Seller Rules.");

    busy.current = true;
    start(async () => {
      try {
        const fd = new FormData();
        // Empty productId = a free-form listing (accounts / boosting).
        fd.set("productId", product.id);
        fd.set("gameSlug", game);
        fd.set("categorySlug", config.slug);
        fd.set("title", title.trim() || product.name);
        fd.set("description", description.trim());
        fd.set("price", String(priceNum));
        fd.set("stock", stock);
        fd.set("minQty", minQty);
        fd.set("deliveryTime", deliveryTime);
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

        const r = await createOfferAction(fd);
        if (!r.ok) {
          setErr(r.error || "Could not create the offer.");
          return;
        }
        router.push(`/seller/offers?cat=${config.slug}`);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      {/* ---------- title / offer details ---------- */}
      {(config.needs_title === 1 || !product.id) && (
        <Card title="Offer Title">
          <div className="mb-1 text-right text-[10.5px] muted">{title.length}/160</div>
          <input
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Type here…"
            className={field}
          />
          <Hint>
            Give your item a descriptive title. What would buyers search for to find it? Put the most
            searchable words at the front. Titles have a 160 character limit.
          </Hint>
        </Card>
      )}

      {/* ---------- admin-defined fields ---------- */}
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
                      className={field}
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : f.field_type === "dropdown" && opts.length ? (
                    <select
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      className={field}
                    >
                      <option value="">Select</option>
                      {opts.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.field_type === "dropdown" ? (
                    <input
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      placeholder="Type here…"
                      className={field}
                    />
                  ) : f.field_type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      placeholder="Type here…"
                      className={`${field} h-auto py-2`}
                    />
                  ) : (
                    <input
                      type={f.field_type === "number" ? "number" : "text"}
                      value={custom[f.field_key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [f.field_key]: e.target.value }))}
                      placeholder="Type here…"
                      className={field}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---------- images ---------- */}
      {config.needs_images === 1 && (
        <Card title="Upload offer photo(s)">
          <Hint>We recommend that your images are at least 800 pixels square.</Hint>
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((im, i) => (
              <span key={i} className="relative h-20 w-20 overflow-hidden rounded-lg soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.data} alt={im.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  aria-label="Remove image"
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
          <div className="mt-2 text-[10.5px] muted">
            Must be JPEG, PNG, WEBP or GIF and cannot exceed 2 MB each.
          </div>
        </Card>
      )}

      {/* ---------- description ---------- */}
      <Card title="Description (Optional)">
        <div className="mb-1 text-right text-[10.5px] muted">{description.length}/2000</div>
        <textarea
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Type here…"
          className={`${field} h-auto py-2`}
        />
        <Hint>
          The listing title and description must be accurate and as informative as possible (no random
          or lottery). A misleading description is a violation of our{" "}
          <Link href="/p/seller-rules" className="text-brand-400 hover:underline">Seller Rules</Link>.
        </Hint>
      </Card>

      {/* ---------- delivery ---------- */}
      <Card title="Delivery">
        {config.needs_credentials === 1 && (
          <div className="mb-3">
            <Label>Delivery method</Label>
            <div className="space-y-1.5">
              {[
                { v: true, l: "Automatic", d: "When the buyer purchases your account, G2X instantly delivers the details so you don't even have to be online." },
                { v: false, l: "Manual", d: "When this offer is sold, you will have to manually send the required account details to the buyer through G2X chat." },
              ].map((o) => (
                <label key={o.l} className="flex cursor-pointer items-start gap-2.5 rounded-lg soft px-3 py-2.5">
                  <input
                    type="radio"
                    checked={auto === o.v}
                    onChange={() => setAuto(o.v)}
                    className="mt-0.5 accent-[var(--brand,#8b3dff)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold">{o.l}</span>
                    <span className="mt-0.5 block text-[11px] muted">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Label req>Guaranteed Delivery Time</Label>
        <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className={field}>
          <option value="">Choose</option>
          {deliveryTimes.map((d) => (
            <option key={d.value} value={d.label}>{d.label}</option>
          ))}
        </select>
        <Hint>Faster delivery time improves your offer&apos;s ranking in the offer list.</Hint>

        {deliveryMethods.length > 0 && config.needs_credentials !== 1 && (
          <div className="mt-3">
            <Label>Delivery method</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {deliveryMethods.map((d) => (
                <label key={d.value} className="flex cursor-pointer items-center gap-2 rounded-lg soft px-3 py-2 text-[12.5px]">
                  <input
                    type="radio"
                    name="dm"
                    checked={deliveryMethod === d.value}
                    onChange={() => setDeliveryMethod(d.value)}
                    className="accent-[var(--brand,#8b3dff)]"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {regions.length > 0 && (
            <div>
              <Label>Region</Label>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={field}>
                <option value="">Select Region</option>
                {regions.map((r) => (
                  <option key={r.value} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
          {platforms.length > 0 && (
            <div>
              <Label>Platform</Label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
                <option value="">Select Platform</option>
                {platforms.map((r) => (
                  <option key={r.value} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
          {loginMethods.length > 0 && config.needs_credentials !== 1 && (
            <div>
              <Label>Login method</Label>
              <select value={loginMethod} onChange={(e) => setLoginMethod(e.target.value)} className={field}>
                <option value="">Select</option>
                {loginMethods.map((r) => (
                  <option key={r.value} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* ---------- account credential vault ---------- */}
      {config.needs_credentials === 1 && auto && (
        <Card title="Account information shared with buyer">
          <div className="space-y-4">
            {accounts.map((a, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-600/15 px-3 py-2">
                  <span className="text-[12.5px] font-bold text-brand-300">Account #{i + 1}</span>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAccounts((p) => p.filter((_, j) => j !== i))}
                      aria-label="Remove account"
                      className="muted transition-colors hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="mb-1 text-[11.5px] font-bold">
                  Account details <span className="muted">(Required)</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <Label>Login / Username</Label>
                    <input value={a.login} onChange={(e) => setAcc(i, "login", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <input value={a.password} onChange={(e) => setAcc(i, "password", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>URL</Label>
                    <input value={a.url} onChange={(e) => setAcc(i, "url", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                </div>

                <div className="mb-1 mt-3 text-[11.5px] font-bold">
                  Email details <span className="muted">(Optional)</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <Label>Login</Label>
                    <input value={a.emailLogin} onChange={(e) => setAcc(i, "emailLogin", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <input value={a.emailPassword} onChange={(e) => setAcc(i, "emailPassword", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                </div>

                <div className="mb-1 mt-3 text-[11.5px] font-bold">
                  2FA details <span className="muted">(Optional)</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div>
                    <Label>Login</Label>
                    <input value={a.twoFaLogin} onChange={(e) => setAcc(i, "twoFaLogin", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <input value={a.twoFaPassword} onChange={(e) => setAcc(i, "twoFaPassword", e.target.value)} placeholder="Type here…" className={field} />
                  </div>
                </div>

                <div className="mb-1 mt-3 text-[11.5px] font-bold">
                  Additional info <span className="muted">(Optional)</span>
                </div>
                <textarea
                  rows={2}
                  value={a.extra}
                  onChange={(e) => setAcc(i, "extra", e.target.value)}
                  placeholder="Type here…"
                  className={`${field} h-auto py-2`}
                />

                <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <AlertTriangle size={14} className="mt-px shrink-0 text-amber-400" />
                  <span className="text-[11px] leading-relaxed text-amber-200/90">
                    <b>Warning: Additional info field is not encrypted.</b> Under no circumstances
                    should you enter sensitive data such as passwords, login details, or personal
                    information.
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAccounts((p) => [...p, emptyAccount()])}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-brand-400 transition-colors hover:text-brand-300"
          >
            <Plus size={13} /> ADD ADDITIONAL ACCOUNT
          </button>

          <div className="mt-3 flex items-start gap-2 rounded-lg soft px-3 py-2.5">
            <Lock size={14} className="mt-px shrink-0 text-brand-400" />
            <span className="text-[11px] leading-relaxed muted">
              Your account information is encrypted and only shared with the buyer after the purchase
              is completed.
            </span>
          </div>
        </Card>
      )}

      {config.needs_credentials === 1 && !auto && (
        <Card title="Manual delivery">
          <Hint>
            You will receive the order in your seller panel and must send the account details to the
            buyer through G2X chat within your guaranteed delivery time.
          </Hint>
          <div className="mt-3">
            <Label>Notes for the buyer (optional)</Label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Type here…"
              className={`${field} h-auto py-2`}
            />
          </div>
        </Card>
      )}

      {/* ---------- quantity ---------- */}
      {config.needs_quantity === 1 && (
        <Card title="Quantity">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label req>Total Quantity available</Label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={`${field} pr-14`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">{unit}</span>
              </div>
            </div>
            <div>
              <Label>Minimum Offer quantity</Label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  className={`${field} pr-14`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">{unit}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---------- price ---------- */}
      <Card title="Price">
        <Label req>Price per {unit}</Label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className={`${field} pr-20`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold muted">
            $ USD
          </span>
        </div>
        <Hint>
          Prices are set in USD and shown to every buyer in their own currency. Competitive prices
          improve your offer&apos;s ranking in the offer list.
        </Hint>
      </Card>

      {/* ---------- volume discount ---------- */}
      {config.allow_volume_discount === 1 && (
        <Card title="Volume discount">
          <div className="space-y-2">
            {volume.map((v, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label>Minimum quantity for discount</Label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={v.qty}
                      onChange={(e) => setVolume((p) => p.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                      placeholder="0"
                      className={`${field} pr-14`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">{unit}</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <Label>Discount percentage</Label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={v.pct}
                      onChange={(e) => setVolume((p) => p.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))}
                      placeholder="0"
                      className={`${field} pr-10`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] muted">%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVolume((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                  aria-label="Remove row"
                  className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg soft muted transition-colors hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVolume((p) => [...p, { qty: "", pct: "" }])}
            className="mt-2.5 rounded-lg soft px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-brand-600/10"
          >
            + Add row
          </button>
        </Card>
      )}

      {/* ---------- fees ---------- */}
      <Card title="Fee structure">
        <div className="space-y-1.5 text-[12.5px]">
          <div className="flex justify-between">
            <span className="muted">Flat fee (per purchase):</span>
            <span className="font-bold">{money(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="muted">Percentage fee (per purchase):</span>
            <span className="font-bold">{commission} % of Price</span>
          </div>
          {priceNum > 0 && (
            <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2">
              <span className="muted">You receive per {unit}:</span>
              <span className="font-black text-emerald-400">{money(net)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* ---------- consent + submit ---------- */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2 text-[12px]">
          <input type="checkbox" checked={agreeTos} onChange={(e) => setAgreeTos(e.target.checked)} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
          <span>
            I have read and agree to the{" "}
            <Link href="/p/terms" className="text-brand-400 hover:underline">Terms of Service</Link>.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[12px]">
          <input type="checkbox" checked={agreeRules} onChange={(e) => setAgreeRules(e.target.checked)} className="mt-0.5 accent-[var(--brand,#8b3dff)]" />
          <span>
            I have read and agree to the{" "}
            <Link href="/p/seller-rules" className="text-brand-400 hover:underline">Seller Rules</Link>.
          </span>
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-300">
          {err}
        </div>
      )}

      <div className="flex items-center gap-3 pb-2">
        <Link
          href={`/seller/sell/${config.slug}/${game}`}
          className="rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-brand-600/10"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-[12.5px] font-bold text-white transition-all hover:bg-brand-500 disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Place offer
        </button>
      </div>
    </div>
  );
}
