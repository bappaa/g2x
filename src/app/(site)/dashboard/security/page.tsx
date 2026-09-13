import { requireUser } from "@/lib/session";
import { all, one } from "@/lib/db";
import SecurityView from "@/components/dash/SecurityView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [row, sessions] = await Promise.all([
    one<{ two_factor: number }>(`SELECT two_factor FROM users WHERE id=?`, [u.id]),
    all(`SELECT id, ip, user_agent, created_at, expires_at FROM sessions WHERE user_id=? ORDER BY created_at DESC`, [u.id]),
  ]);
  return <SecurityView twoFactor={Number(row?.two_factor ?? 0) === 1} sessions={sessions as never} />;
}
