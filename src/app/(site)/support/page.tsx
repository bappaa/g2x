import { getSessionUser } from "@/lib/session";
import { all } from "@/lib/db";
import SupportView from "@/components/support/SupportView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help Center — G2X.GG" };

export default async function Page() {
  const u = await getSessionUser();
  const tickets = u
    ? await all(
        `SELECT code, subject, category, status, created_at FROM tickets WHERE user_id=? ORDER BY created_at DESC`,
        [u.id]
      )
    : [];
  return <SupportView signedIn={!!u} tickets={tickets as never} />;
}
