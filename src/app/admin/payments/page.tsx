import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function Page() {
  await requireAdmin("payments");
  redirect("/admin/transactions");
}
