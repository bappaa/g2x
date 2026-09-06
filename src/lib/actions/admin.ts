"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { all, one, run, tx, nid } from "../db";
import { requireAdmin } from "../admin";
import { saveMedia, deleteMedia, resolveImageField } from "../media";
import { mail } from "../mail";
import { pinManual, unpinManual, refreshRates } from "../fx";

export type R = { ok: boolean; error?: string; id?: string };

const num = (v: FormDataEntryValue | null, d = 0) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : d;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function audit(actorId: string, action: string, target: string, meta?: unknown) {
  await run(
    `INSERT INTO audit_logs (id,actor_id,actor_role,action,target,meta) VALUES (?,?, 'admin', ?,?,?)`,
    [nid("aud_"), actorId, action, target, meta ? JSON.stringify(meta) : null]
  );
}

async function notify(userId: string, title: string, body: string, href: string, kind = "system") {
  await run(`INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?,?)`, [
    nid("ntf_"), userId, title, body, href, kind,
  ]);
}

async function emailOf(userId: string): Promise<string | null> {
  const u = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [userId]);
  return u?.email ?? null;
}

const bustCatalog = () => {
  revalidateTag("catalog");
  revalidatePath("/", "layout");
};

/* ==================================================================== */
/* GAMES                                                                */
/* ==================================================================== */

export async function saveGameAction(form: FormData): Promise<R> {
  const a = await requireAdmin("catalog");
  const original = String(form.get("original") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim() || slugify(name);
  const uploaded = await resolveImageField(form, "logoFile", "logo", {
    kind: "game_icon",
    refKey: slug || original,
    userId: a.id,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };
  const logo = uploaded.url || "/art/coins.png";
  const accent = String(form.get("accent") ?? "#8b3dff").trim();
  const status = String(form.get("status") ?? "active");
  const sortOrder = Math.floor(num(form.get("sortOrder")));
  const cats = form.getAll("categories").map(String);

  if (name.length < 2) return { ok: false, error: "Game name is too short." };
  if (!slug) return { ok: false, error: "Slug is required." };

  if (original) {
    await run(
      `UPDATE games SET name=?, logo=?, accent=?, status=?, sort_order=? WHERE slug=?`,
      [name, logo, accent, status, sortOrder, original]
    );
  } else {
    const dupe = await one(`SELECT slug FROM games WHERE slug=?`, [slug]);
    if (dupe) return { ok: false, error: "A game with that slug already exists." };
    await run(
      `INSERT INTO games (slug,name,logo,accent,status,sort_order) VALUES (?,?,?,?,?,?)`,
      [slug, name, logo, accent, status, sortOrder]
    );
  }

  const key = original || slug;
  await run(`DELETE FROM game_categories WHERE game_slug=?`, [key]);
  for (const c of cats)
    await run(`INSERT OR IGNORE INTO game_categories (game_slug,category_slug) VALUES (?,?)`, [key, c]);

  await audit(a.id, original ? "game.update" : "game.create", key);
  bustCatalog();
  revalidatePath("/admin/games");
  return { ok: true };
}

export async function deleteGameAction(slug: string): Promise<R> {
  const a = await requireAdmin("catalog");
  const n = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM products WHERE game_slug=?`, [slug]);
  if (Number(n?.n ?? 0) > 0)
    return { ok: false, error: `This game has ${n?.n} products. Deactivate it instead, or delete the products first.` };
  await run(`DELETE FROM game_categories WHERE game_slug=?`, [slug]);
  await run(`DELETE FROM games WHERE slug=?`, [slug]);
  await audit(a.id, "game.delete", slug);
  bustCatalog();
  revalidatePath("/admin/games");
  return { ok: true };
}

export async function toggleGameAction(slug: string, status: string): Promise<R> {
  const a = await requireAdmin("catalog");
  await run(`UPDATE games SET status=? WHERE slug=?`, [status, slug]);
  await audit(a.id, "game.status", slug, { status });
  bustCatalog();
  revalidatePath("/admin/games");
  return { ok: true };
}

export async function reorderGamesAction(order: string[]): Promise<R> {
  const a = await requireAdmin("catalog");
  await tx(order.map((slug, i) => ({ sql: `UPDATE games SET sort_order=? WHERE slug=?`, args: [i, slug] })) as never);
  await audit(a.id, "game.reorder", `${order.length} games`);
  bustCatalog();
  return { ok: true };
}

/* ==================================================================== */
/* CATEGORIES                                                           */
/* ==================================================================== */

export async function saveCategoryAction(form: FormData): Promise<R> {
  const a = await requireAdmin("catalog");
  const original = String(form.get("original") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim() || slugify(name);
  const blurb = String(form.get("blurb") ?? "").trim();
  const icon = String(form.get("icon") ?? "").trim();
  const status = String(form.get("status") ?? "active");
  const sortOrder = Math.floor(num(form.get("sortOrder")));

  if (name.length < 2) return { ok: false, error: "Category name is too short." };

  if (original) {
    await run(
      `UPDATE categories SET name=?, blurb=?, icon=?, status=?, sort_order=? WHERE slug=?`,
      [name, blurb, icon, status, sortOrder, original]
    );
  } else {
    const dupe = await one(`SELECT slug FROM categories WHERE slug=?`, [slug]);
    if (dupe) return { ok: false, error: "That category slug already exists." };
    await run(
      `INSERT INTO categories (slug,name,blurb,icon,status,sort_order) VALUES (?,?,?,?,?,?)`,
      [slug, name, blurb, icon, status, sortOrder]
    );
  }
  await audit(a.id, original ? "category.update" : "category.create", original || slug);
  bustCatalog();
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function deleteCategoryAction(slug: string): Promise<R> {
  const a = await requireAdmin("catalog");
  const n = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM products WHERE category_slug=?`, [slug]);
  if (Number(n?.n ?? 0) > 0)
    return { ok: false, error: `This category has ${n?.n} products. Deactivate it instead.` };
  await run(`DELETE FROM game_categories WHERE category_slug=?`, [slug]);
  await run(`DELETE FROM categories WHERE slug=?`, [slug]);
  await audit(a.id, "category.delete", slug);
  bustCatalog();
  revalidatePath("/admin/categories");
  return { ok: true };
}

/* ==================================================================== */
/* SERVICE / FIELD TEMPLATES                                            */
/* ==================================================================== */

export async function saveTemplateFieldAction(form: FormData): Promise<R> {
  const a = await requireAdmin("catalog");
  const id = String(form.get("id") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const fieldKey = String(form.get("fieldKey") ?? "").trim() || slugify(label).replace(/-/g, "_");
  const fieldType = String(form.get("fieldType") ?? "text");
  const optionsRaw = String(form.get("options") ?? "").trim();
  const required = form.get("required") ? 1 : 0;
  const showFrontend = form.get("showFrontend") ? 1 : 0;
  const sortOrder = Math.floor(num(form.get("sortOrder")));

  if (!category) return { ok: false, error: "Pick a category." };
  if (label.length < 2) return { ok: false, error: "Field label is too short." };

  const options = optionsRaw
    ? JSON.stringify(optionsRaw.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  if (id) {
    await run(
      `UPDATE field_templates SET label=?, field_key=?, field_type=?, options=?,
              required=?, show_frontend=?, sort_order=? WHERE id=?`,
      [label, fieldKey, fieldType, options, required, showFrontend, sortOrder, id]
    );
  } else {
    await run(
      `INSERT INTO field_templates (id,category_slug,label,field_key,field_type,options,
              required,show_frontend,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`,
      [nid("fld_"), category, label, fieldKey, fieldType, options, required, showFrontend, sortOrder]
    );
  }
  await audit(a.id, "template.save", `${category}.${fieldKey}`);
  revalidatePath("/admin/templates");
  return { ok: true };
}

export async function deleteTemplateFieldAction(id: string): Promise<R> {
  const a = await requireAdmin("catalog");
  await run(`DELETE FROM field_templates WHERE id=?`, [id]);
  await audit(a.id, "template.delete", id);
  revalidatePath("/admin/templates");
  return { ok: true };
}

/* ==================================================================== */
/* PRODUCTS / PACKAGES                                                  */
/* ==================================================================== */

export async function saveProductAction(form: FormData): Promise<R> {
  const a = await requireAdmin("catalog");
  const id = String(form.get("id") ?? "").trim();
  const game = String(form.get("game") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim() || slugify(name);
  const uploadedImg = await resolveImageField(form, "imageFile", "image", {
    kind: "product",
    refKey: id || slug,
    userId: a.id,
  });
  if (!uploadedImg.ok) return { ok: false, error: uploadedImg.error };
  const image = uploadedImg.url || "/art/coins.png";
  const basePrice = num(form.get("basePrice"));
  const oldPrice = num(form.get("oldPrice"));
  const discount = num(form.get("discount"));
  const region = String(form.get("region") ?? "Global").trim();
  const platform = String(form.get("platform") ?? "All").trim();
  const deliveryMethod = String(form.get("deliveryMethod") ?? "").trim();
  const deliveryTime = String(form.get("deliveryTime") ?? "").trim();
  const loginMethod = String(form.get("loginMethod") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim();
  const status = String(form.get("status") ?? "active");
  const popular = form.get("popular") ? 1 : 0;
  const featured = form.get("featured") ? 1 : 0;
  const pinned = form.get("pinned") ? 1 : 0;
  const sortOrder = Math.floor(num(form.get("sortOrder")));

  if (!game || !category) return { ok: false, error: "Choose a game and a category." };
  if (name.length < 2) return { ok: false, error: "Product name is too short." };
  if (!(basePrice > 0)) return { ok: false, error: "Price must be greater than 0." };

  if (id) {
    await run(
      `UPDATE products SET game_slug=?, category_slug=?, name=?, slug=?, image=?, base_price=?,
              old_price=?, discount_pct=?, region=?, platform=?, delivery_method=?, delivery_time=?,
              login_method=?, delivery_instructions=?, status=?, popular=?, featured=?, pinned=?,
              sort_order=? WHERE id=?`,
      [game, category, name, slug, image, basePrice, oldPrice || null, discount || null, region,
       platform, deliveryMethod, deliveryTime, loginMethod || null, instructions || null, status,
       popular, featured, pinned, sortOrder, id]
    );
  } else {
    await run(
      `INSERT INTO products (id,slug,game_slug,category_slug,name,image,base_price,old_price,
              discount_pct,region,platform,delivery_method,delivery_time,login_method,
              delivery_instructions,status,popular,featured,pinned,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nid("prd_"), slug, game, category, name, image, basePrice, oldPrice || null,
       discount || null, region, platform, deliveryMethod, deliveryTime, loginMethod || null,
       instructions || null, status, popular, featured, pinned, sortOrder]
    );
  }
  await audit(a.id, id ? "product.update" : "product.create", id || slug);
  bustCatalog();
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function deleteProductAction(id: string): Promise<R> {
  const a = await requireAdmin("catalog");
  const n = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM offers WHERE product_id=?`, [id]);
  if (Number(n?.n ?? 0) > 0)
    return { ok: false, error: `${n?.n} seller offers use this product. Deactivate it instead.` };
  await run(`DELETE FROM products WHERE id=?`, [id]);
  await audit(a.id, "product.delete", id);
  bustCatalog();
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function bulkProductAction(ids: string[], op: string, value?: number): Promise<R> {
  const a = await requireAdmin("catalog");
  if (!ids.length) return { ok: false, error: "Select at least one product." };
  const q = ids.map(() => "?").join(",");

  if (op === "activate") await run(`UPDATE products SET status='active' WHERE id IN (${q})`, ids);
  else if (op === "deactivate") await run(`UPDATE products SET status='inactive' WHERE id IN (${q})`, ids);
  else if (op === "popular") await run(`UPDATE products SET popular=1 WHERE id IN (${q})`, ids);
  else if (op === "unpopular") await run(`UPDATE products SET popular=0 WHERE id IN (${q})`, ids);
  else if (op === "price_pct" && value != null)
    await run(
      `UPDATE products SET base_price = ROUND(base_price * (1 + ?/100.0), 2) WHERE id IN (${q})`,
      [value, ...ids]
    );
  else if (op === "delete") await run(`DELETE FROM products WHERE id IN (${q})`, ids);
  else return { ok: false, error: "Unknown bulk operation." };

  await audit(a.id, "product.bulk", op, { count: ids.length, value });
  bustCatalog();
  revalidatePath("/admin/products");
  return { ok: true };
}

/* ==================================================================== */
/* OFFERS (admin moderation)                                            */
/* ==================================================================== */

export async function adminOfferStatusAction(id: string, status: string, note?: string): Promise<R> {
  const a = await requireAdmin("offers");
  const o = await one<{ seller_id: string; title: string }>(
    `SELECT seller_id, title FROM offers WHERE id=?`, [id]
  );
  await run(`UPDATE offers SET status=?, admin_note=?, updated_at=datetime('now') WHERE id=?`, [
    status, note ?? null, id,
  ]);
  if (o && status === "rejected")
    await notify(o.seller_id, "Offer rejected by admin", note || `"${o.title}" was removed from sale.`, "/seller/offers");
  await audit(a.id, "offer.status", id, { status, note });
  revalidatePath("/admin/offers");
  return { ok: true };
}

export async function adminOfferFlagsAction(
  id: string,
  flags: { featured?: boolean; recommended?: boolean; pinned?: boolean }
): Promise<R> {
  const a = await requireAdmin("offers");
  const sets: string[] = [];
  const args: unknown[] = [];
  if (flags.featured != null) { sets.push("featured=?"); args.push(flags.featured ? 1 : 0); }
  if (flags.recommended != null) { sets.push("recommended=?"); args.push(flags.recommended ? 1 : 0); }
  if (flags.pinned != null) { sets.push("pinned=?"); args.push(flags.pinned ? 1 : 0); }
  if (!sets.length) return { ok: true };
  args.push(id);
  await run(`UPDATE offers SET ${sets.join(", ")} WHERE id=?`, args as never);
  await audit(a.id, "offer.flags", id, flags);
  revalidatePath("/admin/offers");
  return { ok: true };
}

/* ==================================================================== */
/* SELLER VERIFICATION                                                  */
/* ==================================================================== */

export async function reviewVerificationAction(
  id: string,
  decision: "approved" | "rejected" | "resubmit",
  note: string
): Promise<R> {
  const a = await requireAdmin("verifications");
  const v = await one<{ user_id: string; full_name: string }>(
    `SELECT user_id, full_name FROM seller_verifications WHERE id=?`, [id]
  );
  if (!v) return { ok: false, error: "Verification not found." };
  if (decision !== "approved" && note.trim().length < 5)
    return { ok: false, error: "Give the seller a reason (5+ characters)." };

  await run(
    `UPDATE seller_verifications SET status=?, review_note=?, reviewed_by=?, reviewed_at=datetime('now')
      WHERE id=?`,
    [decision, note.trim() || null, a.id, id]
  );

  if (decision === "approved") {
    await run(
      `UPDATE seller_profiles SET status='active', verified=1, approved_at=datetime('now') WHERE user_id=?`,
      [v.user_id]
    );
    await run(`UPDATE users SET role = CASE WHEN role='admin' THEN role ELSE 'seller' END, is_seller=1 WHERE id=?`, [v.user_id]);
    await notify(v.user_id, "You're verified — start selling!", "Your identity check passed. Your seller panel is now unlocked.", "/seller");
  } else {
    await run(`UPDATE seller_profiles SET status=? WHERE user_id=?`, [
      decision === "rejected" ? "rejected" : "pending", v.user_id,
    ]);
    await notify(
      v.user_id,
      decision === "rejected" ? "Verification rejected" : "Verification needs changes",
      note,
      "/dashboard/become-seller"
    );
  }

  const kycEmail = await emailOf(v.user_id);
  if (kycEmail) await mail.kycDecision(kycEmail, decision === "approved", note);

  await audit(a.id, "verification." + decision, id, { user: v.user_id });
  revalidatePath("/admin/verifications");
  revalidatePath("/admin/sellers");
  return { ok: true };
}

/* ==================================================================== */
/* SELLERS                                                              */
/* ==================================================================== */

export async function sellerStatusAction(userId: string, status: string): Promise<R> {
  const a = await requireAdmin("sellers");
  await run(`UPDATE seller_profiles SET status=? WHERE user_id=?`, [status, userId]);
  if (status === "suspended")
    await run(`UPDATE offers SET status='paused' WHERE seller_id=?`, [userId]);
  await notify(userId, `Seller account ${status}`, `An admin set your store status to ${status}.`, "/seller");
  await audit(a.id, "seller.status", userId, { status });
  revalidatePath("/admin/sellers");
  return { ok: true };
}

export async function sellerSettingsAction(form: FormData): Promise<R> {
  const a = await requireAdmin("sellers");
  const userId = String(form.get("userId") ?? "");
  const level = String(form.get("level") ?? "").trim();
  const badge = String(form.get("badge") ?? "").trim();
  const commission = num(form.get("commission"), 8);
  const featured = form.get("featured") ? 1 : 0;
  const topSeller = form.get("topSeller") ? 1 : 0;
  const verified = form.get("verified") ? 1 : 0;
  const showHome = form.get("showHomepage") ? 1 : 0;
  const rankOrder = Math.floor(num(form.get("rankOrder")));

  if (commission < 0 || commission > 50)
    return { ok: false, error: "Commission must be between 0 and 50%." };

  await run(
    `UPDATE seller_profiles SET level=?, custom_badge=?, commission_pct=?, featured=?,
            top_seller=?, verified=?, show_homepage=?, rank_order=? WHERE user_id=?`,
    [level, badge || null, commission, featured, topSeller, verified, showHome, rankOrder, userId]
  );
  await audit(a.id, "seller.settings", userId, { commission, level });
  revalidatePath("/admin/sellers");
  return { ok: true };
}

export async function reorderSellersAction(order: string[]): Promise<R> {
  const a = await requireAdmin("sellers");
  await tx(order.map((uid, i) => ({ sql: `UPDATE seller_profiles SET rank_order=? WHERE user_id=?`, args: [i, uid] })) as never);
  await audit(a.id, "seller.reorder", `${order.length}`);
  revalidatePath("/admin/sellers");
  return { ok: true };
}

/* ==================================================================== */
/* USERS                                                                */
/* ==================================================================== */

export async function userStatusAction(userId: string, status: string): Promise<R> {
  const a = await requireAdmin("users");
  if (userId === a.id) return { ok: false, error: "You cannot change your own status." };
  await run(`UPDATE users SET status=? WHERE id=?`, [status, userId]);
  if (status !== "active") await run(`DELETE FROM sessions WHERE user_id=?`, [userId]);
  await audit(a.id, "user.status", userId, { status });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function adjustBalanceAction(userId: string, amount: number, reason: string): Promise<R> {
  const a = await requireAdmin("payments");
  if (!Number.isFinite(amount) || amount === 0) return { ok: false, error: "Enter a non-zero amount." };
  if (!reason.trim()) return { ok: false, error: "A reason is required for the audit trail." };

  await tx([
    { sql: `UPDATE users SET balance = MAX(0, balance + ?) WHERE id=?`, args: [amount, userId] },
    {
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference)
            VALUES (?,?, 'adjustment', ?, ?)`,
      args: [nid("txn_"), userId, amount, `Admin adjustment — ${reason.trim()}`],
    },
  ] as never);

  await notify(
    userId,
    amount > 0 ? "Wallet credited" : "Wallet adjusted",
    `${amount > 0 ? "+" : "−"}$${Math.abs(amount).toFixed(2)} — ${reason.trim()}`,
    "/dashboard/wallet",
    "wallet"
  );
  await audit(a.id, "user.balance", userId, { amount, reason });
  revalidatePath("/admin/users");
  revalidatePath("/admin/wallets");
  return { ok: true };
}

/* ==================================================================== */
/* ORDERS                                                               */
/* ==================================================================== */

export async function adminOrderStatusAction(code: string, status: string, note: string): Promise<R> {
  const a = await requireAdmin("orders");
  const o = await one<{ id: string; buyer_id: string }>(
    `SELECT id, buyer_id FROM orders WHERE code=?`, [code]
  );
  if (!o) return { ok: false, error: "Order not found." };

  await tx([
    { sql: `UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`, args: [status, o.id] },
    {
      sql: `INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?,?, 'admin')`,
      args: [nid("evt_"), o.id, note || `Status set to ${status} by admin`],
    },
  ] as never);

  await notify(o.buyer_id, `Order ${code} updated`, note || `Status is now ${status}.`, `/dashboard/orders/${code}`);
  await audit(a.id, "order.status", code, { status, note });
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function adminRefundAction(code: string, amount: number, reason: string): Promise<R> {
  const a = await requireAdmin("payments");
  const o = await one<{ id: string; buyer_id: string; total: number; status: string }>(
    `SELECT id, buyer_id, total, status FROM orders WHERE code=?`, [code]
  );
  if (!o) return { ok: false, error: "Order not found." };
  if (o.status === "refunded") return { ok: false, error: "This order was already refunded." };
  const amt = amount > 0 ? Math.min(amount, Number(o.total)) : Number(o.total);

  await tx([
    { sql: `UPDATE orders SET status='refunded', updated_at=datetime('now') WHERE id=?`, args: [o.id] },
    { sql: `UPDATE order_items SET status='refunded' WHERE order_id=?`, args: [o.id] },
    { sql: `UPDATE users SET balance = balance + ? WHERE id=?`, args: [amt, o.buyer_id] },
    {
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
            VALUES (?,?, 'refund', ?, ?, ?)`,
      args: [nid("txn_"), o.buyer_id, amt, `Refund for ${code}`, o.id],
    },
    {
      sql: `INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?,?, 'admin')`,
      args: [nid("evt_"), o.id, `Refunded $${amt.toFixed(2)} — ${reason}`],
    },
  ] as never);

  await notify(o.buyer_id, `Refund issued for ${code}`, `$${amt.toFixed(2)} was returned to your wallet.`, "/dashboard/wallet", "wallet");
  await audit(a.id, "order.refund", code, { amt, reason });
  revalidatePath("/admin/orders");
  return { ok: true };
}

/* ==================================================================== */
/* DISPUTES                                                             */
/* ==================================================================== */

export async function resolveDisputeAction(form: {
  code: string;
  decision: "buyer" | "seller" | "partial";
  refundType: "full" | "partial" | "none";
  amount?: number;
  note: string;
}): Promise<R> {
  const a = await requireAdmin("disputes");
  const d = await one<{ id: string; order_id: string; buyer_id: string; seller_id: string; amount: number }>(
    `SELECT id, order_id, buyer_id, seller_id, amount FROM disputes WHERE code=?`,
    [form.code]
  );
  if (!d) return { ok: false, error: "Dispute not found." };
  if (!form.note.trim()) return { ok: false, error: "Add a resolution note." };

  const refund =
    form.refundType === "full" ? Number(d.amount) :
    form.refundType === "partial" ? Math.min(Number(form.amount ?? 0), Number(d.amount)) : 0;

  const stmts: { sql: string; args: unknown[] }[] = [
    {
      sql: `UPDATE disputes SET status='resolved', resolution=? WHERE id=?`,
      args: [`${form.decision === "buyer" ? "Buyer favoured" : form.decision === "seller" ? "Seller favoured" : "Partial"} — ${form.note.trim()}`, d.id],
    },
    {
      sql: `INSERT INTO dispute_messages (id,dispute_id,sender,body) VALUES (?,?, 'admin', ?)`,
      args: [nid("dmg_"), d.id, form.note.trim()],
    },
  ];

  if (refund > 0) {
    stmts.push(
      { sql: `UPDATE users SET balance = balance + ? WHERE id=?`, args: [refund, d.buyer_id] },
      {
        sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
              VALUES (?,?, 'refund', ?, ?, ?)`,
        args: [nid("txn_"), d.buyer_id, refund, `Dispute ${form.code} refund`, d.order_id],
      },
      {
        sql: `UPDATE seller_profiles SET pending_bal = MAX(0, pending_bal - ?) WHERE user_id=?`,
        args: [refund, d.seller_id],
      }
    );
  } else {
    // seller wins — release escrow to available
    stmts.push({
      sql: `UPDATE seller_profiles SET pending_bal = MAX(0, pending_bal - ?),
                   available_bal = available_bal + ? WHERE user_id=?`,
      args: [Number(d.amount), Number(d.amount), d.seller_id],
    });
  }

  await tx(stmts as never);
  await notify(d.buyer_id, `Dispute ${form.code} resolved`, form.note.trim(), "/dashboard/disputes", "dispute");
  await notify(d.seller_id, `Dispute ${form.code} resolved`, form.note.trim(), "/seller/disputes", "dispute");

  const [buyerMail, sellerMail] = await Promise.all([emailOf(d.buyer_id), emailOf(d.seller_id)]);
  if (buyerMail)
    await mail.disputeUpdate(buyerMail, { code: form.code, status: "resolved", note: form.note.trim() });
  if (sellerMail)
    await mail.disputeUpdate(sellerMail, { code: form.code, status: "resolved", note: form.note.trim() });
  if (refund > 0 && buyerMail)
    await mail.refundIssued(buyerMail, {
      code: form.code,
      amount: `$${refund.toFixed(2)}`,
      reason: form.note.trim(),
    });
  await audit(a.id, "dispute.resolve", form.code, form);
  revalidatePath("/admin/disputes");
  return { ok: true };
}

export async function disputeStatusAction(code: string, status: string): Promise<R> {
  const a = await requireAdmin("disputes");
  await run(`UPDATE disputes SET status=? WHERE code=?`, [status, code]);
  await audit(a.id, "dispute.status", code, { status });
  revalidatePath("/admin/disputes");
  return { ok: true };
}

export async function adminDisputeReplyAction(code: string, body: string): Promise<R> {
  await requireAdmin("disputes");
  const d = await one<{ id: string; buyer_id: string; seller_id: string }>(
    `SELECT id, buyer_id, seller_id FROM disputes WHERE code=?`, [code]
  );
  if (!d) return { ok: false, error: "Dispute not found." };
  if (!body.trim()) return { ok: false, error: "Message is empty." };
  await run(`INSERT INTO dispute_messages (id,dispute_id,sender,body) VALUES (?,?, 'admin', ?)`, [
    nid("dmg_"), d.id, body.trim(),
  ]);
  await run(`UPDATE disputes SET status='under_review' WHERE id=? AND status='open'`, [d.id]);
  await notify(d.buyer_id, "Support replied to your dispute", body.trim().slice(0, 90), "/dashboard/disputes", "dispute");
  await notify(d.seller_id, "Support replied to a dispute", body.trim().slice(0, 90), "/seller/disputes", "dispute");
  revalidatePath("/admin/disputes");
  return { ok: true };
}

/* ==================================================================== */
/* SUPPORT TICKETS                                                      */
/* ==================================================================== */

export async function ticketReplyAction(code: string, body: string, status?: string): Promise<R> {
  const a = await requireAdmin("disputes");
  const t = await one<{ id: string; user_id: string }>(`SELECT id, user_id FROM tickets WHERE code=?`, [code]);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (body.trim())
    await run(`INSERT INTO ticket_messages (id,ticket_id,sender,body) VALUES (?,?, 'admin', ?)`, [
      nid("tmg_"), t.id, body.trim(),
    ]);
  if (status) await run(`UPDATE tickets SET status=? WHERE id=?`, [status, t.id]);
  if (body.trim()) {
    await notify(t.user_id, `Support replied to ${code}`, body.trim().slice(0, 90), "/support");
    const m = await emailOf(t.user_id);
    if (m) await mail.ticketReply(m, { code, body: body.trim() });
  }
  await audit(a.id, "ticket.reply", code, { status });
  revalidatePath("/admin/tickets");
  return { ok: true };
}

/* ==================================================================== */
/* MESSAGE MONITORING                                                   */
/* ==================================================================== */

export async function reviewMessageAction(id: string, action: "clear" | "warn" | "ban"): Promise<R> {
  const a = await requireAdmin("messages");
  const m = await one<{ sender_id: string; body: string }>(
    `SELECT sender_id, body FROM messages WHERE id=?`, [id]
  );
  if (!m) return { ok: false, error: "Message not found." };

  await run(`UPDATE messages SET admin_reviewed=1, flagged=? WHERE id=?`, [
    action === "clear" ? 0 : 1, id,
  ]);

  if (action === "warn")
    await notify(
      m.sender_id,
      "⚠️ Policy warning",
      "You attempted to share contact details or move a deal off-platform. This violates the G2X terms. Repeat offences lead to a permanent ban.",
      "/p/terms"
    );

  if (action === "ban") {
    await run(`UPDATE users SET status='suspended' WHERE id=?`, [m.sender_id]);
    await run(`DELETE FROM sessions WHERE user_id=?`, [m.sender_id]);
    await run(`UPDATE seller_profiles SET status='suspended' WHERE user_id=?`, [m.sender_id]);
    await run(`UPDATE offers SET status='paused' WHERE seller_id=?`, [m.sender_id]);
    const banned = await emailOf(m.sender_id);
    if (banned)
      await mail.securityAlert(banned, {
        title: "Your G2X account has been suspended",
        detail: "We detected an attempt to move a deal off-platform or share contact details, which breaks our terms.",
      });
  }

  await audit(a.id, "message." + action, id, { sender: m.sender_id });
  revalidatePath("/admin/messages");
  return { ok: true };
}

/* ==================================================================== */
/* WITHDRAWALS                                                          */
/* ==================================================================== */

export async function reviewWithdrawalAction(
  id: string,
  decision: "approved" | "paid" | "rejected",
  note: string
): Promise<R> {
  const a = await requireAdmin("withdrawals");
  const w = await one<{ seller_id: string; amount: number; status: string }>(
    `SELECT seller_id, amount, status FROM withdrawals WHERE id=?`, [id]
  );
  if (!w) return { ok: false, error: "Withdrawal not found." };

  if (decision === "rejected") {
    if (w.status === "paid") return { ok: false, error: "Already paid out." };
    await tx([
      { sql: `UPDATE withdrawals SET status='rejected', admin_note=?, processed_at=datetime('now') WHERE id=?`, args: [note, id] },
      { sql: `UPDATE seller_profiles SET available_bal = available_bal + ? WHERE user_id=?`, args: [w.amount, w.seller_id] },
      {
        sql: `INSERT INTO transactions (id,user_id,type,amount,reference)
              VALUES (?,?, 'refund', ?, 'Withdrawal rejected — funds returned')`,
        args: [nid("txn_"), w.seller_id, w.amount],
      },
    ] as never);
    await notify(w.seller_id, "Withdrawal rejected", note || "Funds returned to your available balance.", "/seller/finance");
    const m = await emailOf(w.seller_id);
    if (m) await mail.payout(m, { amount: `$${Number(w.amount).toFixed(2)}`, status: "rejected", note });
  } else {
    await run(`UPDATE withdrawals SET status=?, admin_note=?, processed_at=datetime('now') WHERE id=?`, [
      decision, note || null, id,
    ]);
    await notify(
      w.seller_id,
      decision === "paid" ? "Payout sent" : "Withdrawal approved",
      `$${Number(w.amount).toFixed(2)} — ${note || "Processing with your payout provider."}`,
      "/seller/finance",
      "wallet"
    );
    const m = await emailOf(w.seller_id);
    if (m) await mail.payout(m, { amount: `$${Number(w.amount).toFixed(2)}`, status: decision, note });
  }

  await audit(a.id, "withdrawal." + decision, id, { note });
  revalidatePath("/admin/withdrawals");
  return { ok: true };
}

/* ==================================================================== */
/* PROMOTIONS                                                           */
/* ==================================================================== */

export async function saveCouponAction(form: FormData): Promise<R> {
  const a = await requireAdmin("promotions");
  const id = String(form.get("id") ?? "").trim();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const discountType = String(form.get("discountType") ?? "percent");
  const discountValue = num(form.get("discountValue"));
  const appliesTo = String(form.get("appliesTo") ?? "all");
  const minOrder = num(form.get("minOrder"));
  const startDate = String(form.get("startDate") ?? "").trim();
  const endDate = String(form.get("endDate") ?? "").trim();
  const usageLimit = Math.floor(num(form.get("usageLimit")));
  const usagePerUser = Math.floor(num(form.get("usagePerUser"), 1));
  const status = String(form.get("status") ?? "active");

  if (code.length < 3) return { ok: false, error: "Coupon code must be 3+ characters." };
  if (!(discountValue > 0)) return { ok: false, error: "Discount must be greater than 0." };
  if (discountType === "percent" && discountValue > 90)
    return { ok: false, error: "Percentage discount cannot exceed 90%." };

  if (id) {
    await run(
      `UPDATE coupons SET code=?, discount_type=?, discount_value=?, applies_to=?, min_order=?,
              start_date=?, end_date=?, usage_limit=?, usage_per_user=?, status=? WHERE id=?`,
      [code, discountType, discountValue, appliesTo, minOrder, startDate || null, endDate || null,
       usageLimit, usagePerUser, status, id]
    );
  } else {
    const dupe = await one(`SELECT id FROM coupons WHERE code=?`, [code]);
    if (dupe) return { ok: false, error: "That coupon code already exists." };
    await run(
      `INSERT INTO coupons (id,code,discount_type,discount_value,applies_to,min_order,
              start_date,end_date,usage_limit,usage_per_user,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [nid("cpn_"), code, discountType, discountValue, appliesTo, minOrder,
       startDate || null, endDate || null, usageLimit, usagePerUser, status]
    );
  }
  await audit(a.id, id ? "coupon.update" : "coupon.create", code);
  revalidatePath("/admin/promotions");
  return { ok: true };
}

export async function deleteCouponAction(id: string): Promise<R> {
  const a = await requireAdmin("promotions");
  await run(`DELETE FROM coupons WHERE id=?`, [id]);
  await audit(a.id, "coupon.delete", id);
  revalidatePath("/admin/promotions");
  return { ok: true };
}

export async function saveAnnouncementAction(form: FormData): Promise<R> {
  const a = await requireAdmin("promotions");
  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const tone = String(form.get("tone") ?? "info");
  const active = form.get("active") ? 1 : 0;
  if (title.length < 3) return { ok: false, error: "Title is too short." };

  if (id) await run(`UPDATE announcements SET title=?, body=?, tone=?, active=? WHERE id=?`, [title, body, tone, active, id]);
  else await run(`INSERT INTO announcements (id,title,body,tone,active) VALUES (?,?,?,?,?)`, [nid("ann_"), title, body, tone, active]);

  await audit(a.id, "announcement.save", title);
  bustCatalog();
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncementAction(id: string): Promise<R> {
  const a = await requireAdmin("promotions");
  await run(`DELETE FROM announcements WHERE id=?`, [id]);
  await audit(a.id, "announcement.delete", id);
  bustCatalog();
  revalidatePath("/admin/announcements");
  return { ok: true };
}

/* ==================================================================== */
/* HOMEPAGE CMS                                                         */
/* ==================================================================== */

export async function saveCmsBlockAction(form: FormData): Promise<R> {
  const a = await requireAdmin("cms");
  const key = String(form.get("key") ?? "").trim();
  if (!key) return { ok: false, error: "Missing block key." };

  const img = await resolveImageField(form, "imageFile", "image", {
    kind: "image",
    refKey: `cms:${key}`,
    userId: a.id,
  });
  if (!img.ok) return { ok: false, error: img.error };

  // List-type blocks (hero perks, trust rows, FAQ) post their rows as JSON.
  let data: string | null = null;
  const raw = String(form.get("data") ?? "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { ok: false, error: "List content must be a JSON array." };
      data = JSON.stringify(parsed);
    } catch {
      return { ok: false, error: "List content is not valid JSON." };
    }
  }

  await run(
    `INSERT INTO cms_blocks (key,title,subtitle,body,image,cta_label,cta_href,data,active,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       title=excluded.title, subtitle=excluded.subtitle, body=excluded.body,
       image=excluded.image, cta_label=excluded.cta_label, cta_href=excluded.cta_href,
       data=excluded.data, active=excluded.active, updated_at=datetime('now')`,
    [
      key,
      String(form.get("title") ?? ""),
      String(form.get("subtitle") ?? ""),
      String(form.get("body") ?? ""),
      img.url,
      String(form.get("ctaLabel") ?? ""),
      String(form.get("ctaHref") ?? ""),
      data,
      form.get("active") ? 1 : 0,
    ]
  );
  await audit(a.id, "cms.save", key);
  revalidateTag("cms");
  revalidatePath("/");
  bustCatalog();
  revalidatePath("/admin/cms");
  return { ok: true };
}

/* ==================================================================== */
/* SYSTEM SETTINGS, ROLES & ADMINS                                      */
/* ==================================================================== */

export async function saveSettingsAction(form: FormData): Promise<R> {
  const a = await requireAdmin("settings");
  const entries = Array.from(form.keys()).filter((k) => k.startsWith("s_"));
  for (const k of entries) {
    const key = k.slice(2);
    const value = String(form.get(k) ?? "").trim();

    /**
     * Exchange rates are special. Blanking an `fx_<CODE>` field means "let the
     * live feed manage this one", so we delete the row and unpin it. Typing a
     * number means the admin wants that rate held, so we pin it and the
     * background refresher will skip it from then on.
     */
    if (/^fx_[A-Z]{3}$/.test(key)) {
      const code = key.slice(3);
      if (!value) {
        await run(`DELETE FROM settings WHERE key=?`, [key]);
        await unpinManual(code);
        continue;
      }
      await pinManual(code);
    }

    await run(
      `INSERT INTO settings (key,value) VALUES (?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    );
  }
  await audit(a.id, "settings.save", `${entries.length} keys`);
  bustCatalog();
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Admin "Sync now" button — pulls fresh market rates immediately. */
export async function refreshRatesAction(): Promise<R> {
  const a = await requireAdmin("settings");
  const r = await refreshRates(true);
  if (!r.ok) return { ok: false, error: r.reason || "Could not reach the rate provider." };
  await audit(a.id, "settings.fx_refresh", `${r.updated} rates from ${r.source}`);
  bustCatalog();
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {
    ok: true,
    error: `Updated ${r.updated} rates from ${r.source}.${
      r.skipped.length ? ` Skipped manual: ${r.skipped.join(", ")}.` : ""
    }`,
  };
}

export async function saveRoleAction(form: FormData): Promise<R> {
  const a = await requireAdmin("admins");
  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const perms = form.getAll("permissions").map(String);
  if (name.length < 3) return { ok: false, error: "Role name is too short." };

  if (id) await run(`UPDATE admin_roles SET name=?, permissions=? WHERE id=?`, [name, JSON.stringify(perms), id]);
  else {
    const dupe = await one(`SELECT id FROM admin_roles WHERE name=?`, [name]);
    if (dupe) return { ok: false, error: "That role already exists." };
    await run(`INSERT INTO admin_roles (id,name,permissions) VALUES (?,?,?)`, [nid("rol_"), name, JSON.stringify(perms)]);
  }
  await audit(a.id, "role.save", name, { perms });
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function assignAdminAction(email: string, roleId: string): Promise<R> {
  const a = await requireAdmin("admins");
  const u = await one<{ id: string }>(`SELECT id FROM users WHERE email=?`, [email.trim().toLowerCase()]);
  if (!u) return { ok: false, error: "No user with that email." };
  await run(`UPDATE users SET role='admin' WHERE id=?`, [u.id]);
  await run(
    `INSERT INTO admin_users (user_id,role_id) VALUES (?,?)
     ON CONFLICT(user_id) DO UPDATE SET role_id=excluded.role_id`,
    [u.id, roleId]
  );
  await notify(u.id, "You are now an admin", "An administrator granted you access to the G2X admin panel.", "/admin");
  await audit(a.id, "admin.assign", u.id, { roleId });
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function revokeAdminAction(userId: string): Promise<R> {
  const a = await requireAdmin("admins");
  if (userId === a.id) return { ok: false, error: "You cannot revoke your own admin access." };
  await run(`DELETE FROM admin_users WHERE user_id=?`, [userId]);
  await run(`UPDATE users SET role='buyer' WHERE id=?`, [userId]);
  await audit(a.id, "admin.revoke", userId);
  revalidatePath("/admin/roles");
  return { ok: true };
}

/* ==================================================================== */
/* OPTION LISTS (admin-managed dropdowns)                               */
/* ==================================================================== */

export async function saveOptionAction(form: FormData): Promise<R> {
  const a = await requireAdmin("catalog");
  const id = String(form.get("id") ?? "").trim();
  const listKey = String(form.get("listKey") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const value = String(form.get("value") ?? "").trim() || slugify(label).replace(/-/g, "_");
  const sortOrder = Math.floor(num(form.get("sortOrder")));
  const active = form.get("active") ? 1 : 0;

  if (!listKey) return { ok: false, error: "Missing list." };
  if (label.length < 1) return { ok: false, error: "Label is required." };

  if (id) {
    await run(
      `UPDATE option_lists SET label=?, value=?, sort_order=?, active=? WHERE id=?`,
      [label, value, sortOrder, active, id]
    );
  } else {
    const dupe = await one(`SELECT id FROM option_lists WHERE list_key=? AND value=?`, [listKey, value]);
    if (dupe) return { ok: false, error: "That option already exists in this list." };
    await run(
      `INSERT INTO option_lists (id,list_key,value,label,sort_order,active) VALUES (?,?,?,?,?,?)`,
      [nid("opt_"), listKey, value, label, sortOrder, active]
    );
  }

  await audit(a.id, id ? "option.update" : "option.create", `${listKey}:${value}`);
  bustCatalog();
  revalidatePath("/admin/options");
  return { ok: true };
}

export async function deleteOptionAction(id: string): Promise<R> {
  const a = await requireAdmin("catalog");
  await run(`DELETE FROM option_lists WHERE id=?`, [id]);
  await audit(a.id, "option.delete", id);
  bustCatalog();
  revalidatePath("/admin/options");
  return { ok: true };
}

/* ==================================================================== */
/* MEDIA LIBRARY                                                        */
/* ==================================================================== */

export async function uploadMediaAction(form: FormData): Promise<R & { url?: string }> {
  const a = await requireAdmin("cms");
  const file = form.get("file");
  if (!file || typeof file === "string") return { ok: false, error: "Choose an image first." };

  const res = await saveMedia(file as File, {
    kind: String(form.get("kind") ?? "image"),
    refKey: String(form.get("refKey") ?? "") || null,
    userId: a.id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await audit(a.id, "media.upload", res.id, { kind: form.get("kind") });
  revalidatePath("/admin/media");
  return { ok: true, id: res.id, url: res.url };
}

export async function deleteMediaAction(id: string): Promise<R> {
  const a = await requireAdmin("cms");
  await deleteMedia(id);
  await audit(a.id, "media.delete", id);
  revalidatePath("/admin/media");
  return { ok: true };
}

/** Set (or clear) a game's icon straight from the media library. */
export async function setGameIconAction(slug: string, url: string): Promise<R> {
  const a = await requireAdmin("catalog");
  await run(`UPDATE games SET logo=? WHERE slug=?`, [url, slug]);
  await audit(a.id, "game.icon", slug, { url });
  bustCatalog();
  revalidatePath("/admin/games");
  revalidatePath("/admin/media");
  return { ok: true };
}

/* ==================================================================== */
/* BANNERS                                                              */
/* ==================================================================== */

export async function saveBannerAction(form: FormData): Promise<R> {
  const a = await requireAdmin("cms");
  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const subtitle = String(form.get("subtitle") ?? "").trim();
  const ctaLabel = String(form.get("ctaLabel") ?? "").trim();
  const ctaHref = String(form.get("ctaHref") ?? "").trim();
  const placement = String(form.get("placement") ?? "hero");
  const bgColor = String(form.get("bgColor") ?? "").trim();
  const sortOrder = Math.floor(num(form.get("sortOrder")));
  const active = form.get("active") ? 1 : 0;

  const img = await resolveImageField(form, "imageFile", "image", {
    kind: "banner",
    userId: a.id,
  });
  if (!img.ok) return { ok: false, error: img.error };

  if (!title && !img.url) return { ok: false, error: "Add a title or an image." };

  if (id) {
    await run(
      `UPDATE banners SET title=?, subtitle=?, image=?, cta_label=?, cta_href=?,
              placement=?, bg_color=?, sort_order=?, active=? WHERE id=?`,
      [title, subtitle, img.url, ctaLabel, ctaHref, placement, bgColor, sortOrder, active, id]
    );
  } else {
    await run(
      `INSERT INTO banners (id,title,subtitle,image,cta_label,cta_href,placement,bg_color,sort_order,active)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [nid("bnr_"), title, subtitle, img.url, ctaLabel, ctaHref, placement, bgColor, sortOrder, active]
    );
  }

  await audit(a.id, id ? "banner.update" : "banner.create", title || id);
  bustCatalog();
  revalidateTag("banners");
  revalidatePath("/");
  revalidatePath("/admin/banners");
  return { ok: true };
}

export async function deleteBannerAction(id: string): Promise<R> {
  const a = await requireAdmin("cms");
  await run(`DELETE FROM banners WHERE id=?`, [id]);
  await audit(a.id, "banner.delete", id);
  bustCatalog();
  revalidateTag("banners");
  revalidatePath("/");
  revalidatePath("/admin/banners");
  return { ok: true };
}

export async function toggleBannerAction(id: string, active: boolean): Promise<R> {
  const a = await requireAdmin("cms");
  await run(`UPDATE banners SET active=? WHERE id=?`, [active ? 1 : 0, id]);
  await audit(a.id, "banner.toggle", id, { active });
  bustCatalog();
  revalidateTag("banners");
  revalidatePath("/");
  revalidatePath("/admin/banners");
  return { ok: true };
}

/** Typeahead for the "Grant admin access" box. */
export async function searchUsersAction(
  q: string
): Promise<{ id: string; name: string; email: string; role: string }[]> {
  await requireAdmin("admins");
  const term = q.trim();
  if (term.length < 2) return [];
  return all<{ id: string; name: string; email: string; role: string }>(
    `SELECT id, name, email, role FROM users
      WHERE email LIKE ? OR name LIKE ?
      ORDER BY (role='admin') DESC, email LIMIT 8`,
    [`%${term}%`, `%${term}%`]
  );
}

/* ==================== navigation links (footer) ==================== */

export async function saveNavLinkAction(form: FormData): Promise<R> {
  const a = await requireAdmin("cms");
  const id = String(form.get("id") ?? "").trim();
  const section = String(form.get("section") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const href = String(form.get("href") ?? "").trim();
  if (!section || !label || !href)
    return { ok: false, error: "Section, label and link are all required." };

  const placement = String(form.get("placement") ?? "footer");
  const sortOrder = Number(form.get("sortOrder") ?? 0) || 0;
  const active = form.get("active") ? 1 : 0;

  if (id) {
    await run(
      `UPDATE nav_links SET section=?, label=?, href=?, placement=?, sort_order=?, active=? WHERE id=?`,
      [section, label, href, placement, sortOrder, active, id]
    );
  } else {
    await run(
      `INSERT INTO nav_links (id,section,label,href,placement,sort_order,active)
       VALUES (?,?,?,?,?,?,?)`,
      [nid("nav_"), section, label, href, placement, sortOrder, active]
    );
  }

  await audit(a.id, id ? "nav.update" : "nav.create", label);
  revalidateTag("nav");
  revalidatePath("/", "layout");
  revalidatePath("/admin/navigation");
  return { ok: true };
}

export async function deleteNavLinkAction(id: string): Promise<R> {
  const a = await requireAdmin("cms");
  await run(`DELETE FROM nav_links WHERE id=?`, [id]);
  await audit(a.id, "nav.delete", id);
  revalidateTag("nav");
  revalidatePath("/", "layout");
  revalidatePath("/admin/navigation");
  return { ok: true };
}

/* ==================== content reset / purge ==================== */

export type PurgeScope =
  | "demo_reviews" | "demo_offers" | "catalog" | "banners" | "cms" | "nav" | "media";

const PURGE_SQL: Record<PurgeScope, { label: string; stmts: string[] }> = {
  demo_reviews: {
    label: "Demo reviews",
    stmts: [`DELETE FROM reviews`],
  },
  demo_offers: {
    label: "Seeded seller offers & listings",
    stmts: [`DELETE FROM offers`, `DELETE FROM listings`],
  },
  catalog: {
    label: "Entire catalog (games, categories, products, offers)",
    stmts: [
      `DELETE FROM offers`,
      `DELETE FROM listings`,
      `DELETE FROM field_templates`,
      `DELETE FROM products`,
      `DELETE FROM game_categories`,
      `DELETE FROM games`,
      `DELETE FROM categories`,
    ],
  },
  banners: { label: "All banners", stmts: [`DELETE FROM banners`] },
  cms: { label: "All homepage CMS blocks", stmts: [`DELETE FROM cms_blocks`] },
  nav: { label: "All footer links", stmts: [`DELETE FROM nav_links`] },
  media: { label: "All uploaded media", stmts: [`DELETE FROM media`] },
};

/**
 * Wipes seeded/demo content so the site can be driven purely by what the
 * admin creates. Deliberately never touches users, orders, wallets,
 * transactions, disputes or admin accounts — only content.
 */
export async function purgeContentAction(
  scopes: PurgeScope[],
  confirmText: string
): Promise<R> {
  const a = await requireAdmin("settings");
  if (confirmText.trim().toUpperCase() !== "DELETE")
    return { ok: false, error: 'Type DELETE to confirm.' };
  if (!scopes.length) return { ok: false, error: "Select at least one thing to remove." };

  const hasOrders = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM orders`);
  if (scopes.includes("catalog") && Number(hasOrders?.n ?? 0) > 0) {
    // Keep referential history intact: orders snapshot their own titles/prices,
    // so clearing the catalog is safe, but we warn in the audit trail.
    await audit(a.id, "content.purge.warn", "catalog", { orders: hasOrders?.n });
  }

  for (const s of scopes) {
    const spec = PURGE_SQL[s];
    if (!spec) continue;
    for (const sql of spec.stmts) await run(sql, []);
  }

  await audit(a.id, "content.purge", scopes.join(","), { scopes });
  revalidateTag("catalog");
  revalidateTag("cms");
  revalidateTag("nav");
  revalidateTag("banners");
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ==================== payment gateways ==================== */

export async function saveGatewayAction(form: FormData): Promise<R> {
  const a = await requireAdmin("payments");
  const id = String(form.get("id") ?? "").trim();
  const code = String(form.get("code") ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const name = String(form.get("name") ?? "").trim();
  if (!code || !name) return { ok: false, error: "Code and name are required." };

  const num = (k: string) => {
    const n = Number(form.get(k) ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  };
  const feePercent = num("feePercent");
  const feeFixed = num("feeFixed");
  if (feePercent > 100) return { ok: false, error: "Percentage fee cannot exceed 100%." };

  const minAmount = num("minAmount");
  const maxAmount = num("maxAmount");
  if (maxAmount > 0 && maxAmount < minAmount)
    return { ok: false, error: "Maximum must be greater than the minimum." };

  const logo = String(form.get("logo") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const sortOrder = Number(form.get("sortOrder") ?? 0) || 0;
  const enabled = form.get("enabled") ? 1 : 0;
  const forTopup = form.get("forTopup") ? 1 : 0;
  const forCheckout = form.get("forCheckout") ? 1 : 0;

  const dupe = await one<{ id: string }>(
    `SELECT id FROM payment_gateways WHERE code=? AND id<>?`,
    [code, id || ""]
  );
  if (dupe) return { ok: false, error: `A gateway with code "${code}" already exists.` };

  if (id) {
    await run(
      `UPDATE payment_gateways SET code=?, name=?, logo=?, fee_percent=?, fee_fixed=?,
              min_amount=?, max_amount=?, enabled=?, for_topup=?, for_checkout=?,
              sort_order=?, note=? WHERE id=?`,
      [code, name, logo, feePercent, feeFixed, minAmount, maxAmount,
       enabled, forTopup, forCheckout, sortOrder, note, id]
    );
  } else {
    await run(
      `INSERT INTO payment_gateways
         (id,code,name,logo,fee_percent,fee_fixed,min_amount,max_amount,
          enabled,for_topup,for_checkout,sort_order,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nid("pg_"), code, name, logo, feePercent, feeFixed, minAmount, maxAmount,
       enabled, forTopup, forCheckout, sortOrder, note]
    );
  }

  await audit(a.id, id ? "gateway.update" : "gateway.create", code, { feePercent, feeFixed });
  revalidateTag("gateways");
  revalidatePath("/", "layout");
  revalidatePath("/admin/gateways");
  return { ok: true };
}

export async function toggleGatewayAction(id: string, enabled: boolean): Promise<R> {
  const a = await requireAdmin("payments");
  await run(`UPDATE payment_gateways SET enabled=? WHERE id=?`, [enabled ? 1 : 0, id]);
  await audit(a.id, "gateway.toggle", id, { enabled });
  revalidateTag("gateways");
  revalidatePath("/", "layout");
  revalidatePath("/admin/gateways");
  return { ok: true };
}

export async function deleteGatewayAction(id: string): Promise<R> {
  const a = await requireAdmin("payments");
  const g = await one<{ code: string }>(`SELECT code FROM payment_gateways WHERE id=?`, [id]);
  if (g?.code === "wallet")
    return { ok: false, error: "The G2X Wallet method cannot be removed." };
  await run(`DELETE FROM payment_gateways WHERE id=?`, [id]);
  await audit(a.id, "gateway.delete", g?.code ?? id);
  revalidateTag("gateways");
  revalidatePath("/", "layout");
  revalidatePath("/admin/gateways");
  return { ok: true };
}

/* ==================== buyer identity checks ==================== */

export async function reviewBuyerKycAction(
  id: string,
  decision: "approved" | "rejected" | "resubmit",
  note: string
): Promise<R> {
  const a = await requireAdmin("verifications");
  const v = await one<{ user_id: string; full_name: string }>(
    `SELECT user_id, full_name FROM buyer_verifications WHERE id=?`,
    [id]
  );
  if (!v) return { ok: false, error: "Verification not found." };
  if (decision !== "approved" && note.trim().length < 5)
    return { ok: false, error: "Give the buyer a reason (5+ characters)." };

  await run(
    `UPDATE buyer_verifications
        SET status=?, review_note=?, reviewed_by=?, reviewed_at=datetime('now')
      WHERE id=?`,
    [decision, note.trim() || null, a.id, id]
  );
  await run(`UPDATE users SET kyc_status=? WHERE id=?`, [decision, v.user_id]);

  await notify(
    v.user_id,
    decision === "approved" ? "Identity verified ✓" : "Identity check needs attention",
    decision === "approved"
      ? "Deposits and purchases of any amount are now unlocked on your account."
      : note,
    "/dashboard/verification"
  );

  const to = await emailOf(v.user_id);
  if (to) await mail.buyerKyc(to, decision, note.trim() || undefined);

  await audit(a.id, "buyer_kyc." + decision, id, { user: v.user_id });
  revalidatePath("/admin/buyer-kyc");
  revalidatePath("/dashboard/verification");
  return { ok: true };
}

/**
 * Send a test email to the signed-in admin.
 *
 * Lets you confirm the Resend key, the verified sending domain and the DNS
 * records are all correct from inside the admin panel, without placing a real
 * order. Reports the underlying provider error verbatim when it fails.
 */
export async function sendTestMailAction(to?: string) {
  const a = await requireAdmin("settings");
  const target = (to || "").trim() || a.email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target))
    return { ok: false as const, error: "Enter a valid email address." };

  if (!process.env.RESEND_API_KEY?.trim())
    return {
      ok: false as const,
      error:
        "RESEND_API_KEY is not set on the server. Add it to .env.local (or your host's env) and restart.",
    };

  const r = await mail.notice(target, {
    title: "G2X test email ✓",
    body:
      "If you can read this, transactional email is configured correctly: the API key is valid, " +
      "the sending domain is verified, and delivery is working. You can safely go live.",
    href: (process.env.NEXT_PUBLIC_APP_URL || "https://g2x.gg") + "/admin/settings",
    cta: "Open admin settings",
    mailbox: "notification",
    tag: "support",
  });

  await audit(a.id, "settings.test_mail", target, { ok: r.ok });

  if (!r.ok) return { ok: false as const, error: r.error || "Send failed." };
  if (r.skipped)
    return {
      ok: false as const,
      error: "Sending is disabled — set 'Send transactional email' to 'on' above and save first.",
    };
  return { ok: true as const, id: r.id, to: target };
}
