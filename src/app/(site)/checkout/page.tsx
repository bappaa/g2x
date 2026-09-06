import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getCart } from "@/lib/queries";
import { one } from "@/lib/db";
import { Breadcrumb } from "@/components/ui";
import CheckoutView from "@/components/shop/CheckoutView";
import { getGateways } from "@/lib/gateways";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout — G2X.GG" };

export default async function CheckoutPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/checkout");
  const items = await getCart(u.id);
  if (!items.length) redirect("/cart");
  const [bal, gateways] = await Promise.all([
    one<{ balance: number }>(`SELECT balance FROM users WHERE id=?`, [u.id]),
    getGateways("checkout"),
  ]);

  return (
    <main className="mx-auto max-w-[1100px] px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]}
      />
      <h1 className="mt-4 text-[20px] font-black sm:text-[26px] tracking-tight">Checkout</h1>
      <CheckoutView items={items} email={u.email} balance={Number(bal?.balance ?? 0)} gateways={gateways} />
    </main>
  );
}
