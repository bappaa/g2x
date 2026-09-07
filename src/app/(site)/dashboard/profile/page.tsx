import { requireUser } from "@/lib/session";
import { one } from "@/lib/db";
import ProfileForm from "@/components/dash/ProfileForm";
import UsernameCard from "@/components/dash/UsernameCard";
import { ensureUsername, usernameChangeFee, FREE_CHANGES } from "@/lib/username";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const row = await one<{
    phone: string | null; country: string | null; provider: string; created_at: string;
    username: string | null; username_changes: number; balance: number;
  }>(
    `SELECT phone, country, provider, created_at, username, username_changes, balance
       FROM users WHERE id=?`,
    [u.id]
  );

  // Older accounts predate usernames — give them one on first visit.
  const username = row?.username ?? (await ensureUsername(u.id)) ?? "";
  const fee = await usernameChangeFee();
  return (
    <div className="space-y-4">
      <UsernameCard
        username={username}
        changesUsed={Number(row?.username_changes ?? 0)}
        freeChanges={FREE_CHANGES}
        fee={fee}
        balance={Number(row?.balance ?? 0)}
      />
      <ProfileForm
      name={u.name}
      email={u.email}
      phone={row?.phone ?? ""}
      country={row?.country ?? ""}
      provider={row?.provider ?? "email"}
      joined={row?.created_at ?? ""}
    />
    </div>
  );
}
