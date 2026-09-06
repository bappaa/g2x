"use server";

import { revalidatePath } from "next/cache";
import { one, run, nid } from "../db";
import { requireUser } from "../session";
import { saveKycFile } from "../storage";
import { idLabel, countryName } from "../kyc";
import { mail } from "../mail";
import { rateLimit } from "../ratelimit";

export type R = { ok: boolean; error?: string; id?: string };

async function notify(userId: string, title: string, body: string, href: string) {
  await run(`INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?, 'system')`, [
    nid("ntf_"), userId, title, body, href,
  ]);
}

/**
 * Buyer submits the light identity check required to spend at or above the
 * admin's threshold. Requires: ID number, a photo of the ID, and a face photo.
 * Lands in Admin → Buyer KYC for approval.
 */
export async function submitBuyerKycAction(form: FormData): Promise<R> {
  const u = await requireUser();

  const rl = await rateLimit(`bkyc:${u.id}`, 5, 60 * 60);
  if (!rl.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const fullName = String(form.get("fullName") ?? "").trim();
  const country = String(form.get("country") ?? "").trim();
  const idType = String(form.get("idType") ?? "").trim();
  const idNumber = String(form.get("idNumber") ?? "").trim().toUpperCase();
  const dob = String(form.get("dob") ?? "").trim();

  if (fullName.length < 3) return { ok: false, error: "Enter your full name exactly as printed on the ID." };
  if (fullName.length > 120) return { ok: false, error: "That name is too long." };
  if (!country) return { ok: false, error: "Select your country." };
  if (!idType) return { ok: false, error: "Select which ID you are submitting." };
  if (idNumber.length < 4 || idNumber.length > 40) return { ok: false, error: "Enter a valid ID number." };

  if (idType === "aadhaar" && !/^\d{12}$/.test(idNumber.replace(/\s/g, "")))
    return { ok: false, error: "Aadhaar must be exactly 12 digits." };
  if (idType === "pan" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(idNumber))
    return { ok: false, error: "PAN must look like ABCDE1234F." };
  if (idType === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(idNumber))
    return { ok: false, error: "SSN must be 9 digits." };

  const existing = await one<{ status: string }>(
    `SELECT status FROM buyer_verifications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`,
    [u.id]
  );
  if (existing?.status === "approved") return { ok: false, error: "You are already verified." };
  if (existing?.status === "pending")
    return { ok: false, error: "You already have a check under review." };

  const idPhoto = form.get("idPhoto") as File | null;
  const facePhoto = form.get("facePhoto") as File | null;
  if (!idPhoto || idPhoto.size === 0) return { ok: false, error: "Upload a photo of your ID." };
  if (!facePhoto || facePhoto.size === 0) return { ok: false, error: "Upload a photo of your face." };

  const a = await saveKycFile(idPhoto, u.id, "buyer-id");
  if (!a.ok) return { ok: false, error: a.error };
  const b = await saveKycFile(facePhoto, u.id, "buyer-face");
  if (!b.ok) return { ok: false, error: b.error };

  const id = nid("kyc_");
  await run(
    `INSERT INTO buyer_verifications
       (id,user_id,full_name,country,id_type,id_number,id_number_last4,dob,
        id_photo_path,face_photo_path,status)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'pending')`,
    [id, u.id, fullName, country, idType, idNumber, idNumber.slice(-4), dob || null, a.key, b.key]
  );
  await run(`UPDATE users SET kyc_status='pending' WHERE id=?`, [u.id]);

  await notify(
    u.id,
    "Identity check submitted",
    `We received your ${idLabel(idType)} (${countryName(country)}). Most checks finish within a few hours.`,
    "/dashboard/verification"
  );

  // tell the compliance desk there is something to review
  await mail.notice("security@g2x.gg", {
    title: "New buyer identity check",
    body: `${fullName} (${u.email}) submitted a ${idLabel(idType)} for review.`,
    href: "/admin/buyer-kyc",
    cta: "Review in admin",
  }).catch(() => {});

  if (u.email)
    await mail.notice(u.email, {
      title: "Identity check received",
      body: "Thanks — our team is reviewing your documents. You'll get an email as soon as it's approved.",
      href: "/dashboard/verification",
      cta: "View status",
    }).catch(() => {});

  revalidatePath("/dashboard/verification");
  revalidatePath("/admin/buyer-kyc");
  return { ok: true, id };
}
