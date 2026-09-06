"use server";

import { revalidatePath } from "next/cache";
import { one, run, nid } from "../db";
import { requireUser } from "../session";
import { saveKycFile } from "../storage";
import { idLabel, countryName } from "../kyc";

export type R = { ok: boolean; error?: string; id?: string };

async function notify(userId: string, title: string, body: string, href: string, kind = "system") {
  await run(`INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?,?)`, [
    nid("ntf_"), userId, title, body, href, kind,
  ]);
}

/**
 * Buyer submits KYC to become a seller.
 * Creates/updates the seller_profiles row as `pending` and stores the
 * verification record + document files. Admin approval flips it to active.
 */
export async function submitVerificationAction(form: FormData): Promise<R> {
  const u = await requireUser();

  const fullName = String(form.get("fullName") ?? "").trim();
  const country = String(form.get("country") ?? "").trim();
  const idType = String(form.get("idType") ?? "").trim();
  const idNumber = String(form.get("idNumber") ?? "").trim().toUpperCase();
  const dob = String(form.get("dob") ?? "").trim();
  const address = String(form.get("address") ?? "").trim();

  const storeName = String(form.get("storeName") ?? "").trim();
  const primaryCat = String(form.get("primaryCat") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  /* ---------------------------- validation ---------------------------- */
  if (fullName.length < 3) return { ok: false, error: "Enter your full legal name as printed on the ID." };
  if (!country) return { ok: false, error: "Select your country." };
  if (!idType) return { ok: false, error: "Select which ID document you are submitting." };
  if (idNumber.length < 4) return { ok: false, error: "Enter a valid ID number." };
  if (storeName.length < 3) return { ok: false, error: "Store name must be at least 3 characters." };

  // country-specific format checks for the most common IDs
  if (idType === "aadhaar" && !/^\d{12}$/.test(idNumber.replace(/\s/g, "")))
    return { ok: false, error: "Aadhaar must be exactly 12 digits." };
  if (idType === "pan" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(idNumber))
    return { ok: false, error: "PAN must look like ABCDE1234F." };
  if (idType === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(idNumber))
    return { ok: false, error: "SSN must be 9 digits." };

  const existing = await one<{ id: string; status: string }>(
    `SELECT id, status FROM seller_verifications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`,
    [u.id]
  );
  if (existing && ["pending", "approved"].includes(existing.status))
    return {
      ok: false,
      error:
        existing.status === "approved"
          ? "Your account is already verified."
          : "You already have a verification under review.",
    };

  /* ------------------------------ files ------------------------------- */
  const front = form.get("front") as File | null;
  const back = form.get("back") as File | null;
  const selfie = form.get("selfie") as File | null;

  if (!front) return { ok: false, error: "Upload the front of your ID." };
  const f = await saveKycFile(front, u.id, "id-front");
  if (!f.ok) return { ok: false, error: f.error };

  let backKey: string | null = null;
  if (back && back.size > 0) {
    const b = await saveKycFile(back, u.id, "id-back");
    if (!b.ok) return { ok: false, error: b.error };
    backKey = b.key;
  }

  let selfieKey: string | null = null;
  if (selfie && selfie.size > 0) {
    const s = await saveKycFile(selfie, u.id, "selfie");
    if (!s.ok) return { ok: false, error: s.error };
    selfieKey = s.key;
  }

  /* ----------------------------- persist ------------------------------ */
  const vid = nid("kyc_");
  await run(
    `INSERT INTO seller_verifications
       (id,user_id,full_name,country,id_type,id_number,id_number_last4,dob,address,
        front_path,back_path,selfie_path,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`,
    [
      vid, u.id, fullName, country, idType, idNumber, idNumber.slice(-4),
      dob || null, address || null, f.key, backKey, selfieKey,
    ]
  );

  // create/refresh the pending seller profile
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const taken = await one(`SELECT slug FROM seller_profiles WHERE slug=? AND user_id<>?`, [slug, u.id]);
  if (taken) return { ok: false, error: "That store name is already taken." };

  await run(
    `INSERT INTO seller_profiles (user_id,store_name,slug,description,primary_cat,status)
     VALUES (?,?,?,?,?, 'pending')
     ON CONFLICT(user_id) DO UPDATE SET
       store_name=excluded.store_name, slug=excluded.slug,
       description=excluded.description, primary_cat=excluded.primary_cat,
       status='pending'`,
    [u.id, storeName, slug, description, primaryCat]
  );
  await run(`UPDATE users SET is_seller=1 WHERE id=?`, [u.id]);

  await notify(
    u.id,
    "Verification submitted",
    `We received your ${idLabel(idType)} (${countryName(country)}). Most reviews finish within 24–48 hours.`,
    "/dashboard/become-seller"
  );

  revalidatePath("/dashboard/become-seller");
  revalidatePath("/admin/verifications");
  return { ok: true, id: vid };
}
