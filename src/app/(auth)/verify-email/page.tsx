import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isEmailVerified } from "@/lib/otp";
import VerifyEmail from "@/components/auth/VerifyEmail";

export const metadata = { title: "Verify your email — G2X.GG" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  // Already done — don't make them sit on a pointless screen.
  if (await isEmailVerified(u.id)) redirect(searchParams.next || "/dashboard");

  return (
    <Suspense>
      <VerifyEmail email={u.email} next={searchParams.next || "/dashboard"} />
    </Suspense>
  );
}
