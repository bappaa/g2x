import "server-only";
import { redirect } from "next/navigation";
import { one } from "./db";
import { getSessionUser, type SessionUser } from "./session";

export const PERMISSIONS = [
  { key: "dashboard", label: "Dashboard Access" },
  { key: "users", label: "Manage Users" },
  { key: "sellers", label: "Manage Sellers" },
  { key: "verifications", label: "Seller Verification" },
  { key: "catalog", label: "Manage Games & Products" },
  { key: "offers", label: "Manage Offers" },
  { key: "orders", label: "Manage Orders" },
  { key: "disputes", label: "Manage Disputes" },
  { key: "messages", label: "Monitor Messages" },
  { key: "payments", label: "Manage Payments" },
  { key: "withdrawals", label: "Manage Withdrawals" },
  { key: "promotions", label: "Manage Promotions" },
  { key: "cms", label: "Manage Homepage CMS" },
  { key: "reports", label: "View Reports" },
  { key: "settings", label: "Manage Settings" },
  { key: "admins", label: "Manage Admins" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const DEFAULT_ROLES: { name: string; permissions: PermissionKey[] }[] = [
  { name: "Super Admin", permissions: PERMISSIONS.map((p) => p.key) },
  { name: "Support Staff", permissions: ["dashboard", "orders", "disputes", "messages", "users"] },
  { name: "Seller Manager", permissions: ["dashboard", "sellers", "verifications", "offers", "catalog"] },
  { name: "Finance Manager", permissions: ["dashboard", "payments", "withdrawals", "reports"] },
  { name: "Content Manager", permissions: ["dashboard", "cms", "promotions", "catalog"] },
];

export type AdminCtx = SessionUser & { permissions: PermissionKey[]; roleName: string };

/** Gate for every /admin page and admin server action. */
export async function requireAdmin(perm?: PermissionKey): Promise<AdminCtx> {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/dashboard");

  const row = await one<{ name: string; permissions: string }>(
    `SELECT r.name, r.permissions FROM admin_users au
       JOIN admin_roles r ON r.id = au.role_id
      WHERE au.user_id = ?`,
    [u.id]
  );

  // an admin with no explicit role row is treated as Super Admin
  let permissions: PermissionKey[] = PERMISSIONS.map((p) => p.key);
  let roleName = "Super Admin";
  if (row) {
    roleName = row.name;
    try {
      permissions = JSON.parse(row.permissions) as PermissionKey[];
    } catch {
      permissions = [];
    }
  }

  if (perm && !permissions.includes(perm)) redirect("/admin?denied=" + perm);
  return { ...u, permissions, roleName };
}

export const can = (ctx: AdminCtx, perm: PermissionKey) => ctx.permissions.includes(perm);
