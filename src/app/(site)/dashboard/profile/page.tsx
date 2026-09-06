import { requireUser } from "@/lib/session";
import { one } from "@/lib/db";
import ProfileForm from "@/components/dash/ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const row = await one<{ phone: string | null; country: string | null; provider: string; created_at: string }>(
    `SELECT phone, country, provider, created_at FROM users WHERE id=?`,
    [u.id]
  );
  return (
    <ProfileForm
      name={u.name}
      email={u.email}
      phone={row?.phone ?? ""}
      country={row?.country ?? ""}
      provider={row?.provider ?? "email"}
      joined={row?.created_at ?? ""}
    />
  );
}
