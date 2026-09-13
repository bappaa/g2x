import { requireUser } from "@/lib/session";
import { getSellerProfile, getCategories } from "@/lib/queries";
import { one } from "@/lib/db";
import BecomeSeller from "@/components/dash/BecomeSeller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a Seller — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [profile, cats, verification] = await Promise.all([
    getSellerProfile(u.id),
    getCategories(),
    one(
      `SELECT id, full_name, country, id_type, id_number_last4, status, review_note,
              submitted_at, reviewed_at
         FROM seller_verifications WHERE user_id=?
        ORDER BY submitted_at DESC LIMIT 1`,
      [u.id]
    ),
  ]);
  return <BecomeSeller profile={profile as never} categories={cats} verification={verification as never} />;
}
