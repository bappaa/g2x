import { requireAdmin } from "@/lib/admin";
import { getAdminStats } from "@/lib/queries-admin";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — G2X.GG" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await requireAdmin();
  const s = await getAdminStats();

  return (
    <div className="min-h-screen">
      <AdminNav
        name={a.name}
        role={a.roleName}
        permissions={a.permissions}
        badges={{
          verifications: s.pendingKyc,
          buyerKyc: s.pendingBuyerKyc,
          disputes: s.openDisputes,
          withdrawals: s.pendingWd,
          messages: s.flagged,
        }}
      />
      <main className="lg:pl-[228px]">
        <div className="mx-auto max-w-[1180px] px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
