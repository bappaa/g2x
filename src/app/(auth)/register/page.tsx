import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Create Account — G2X.GG" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <Suspense>
      <AuthForm mode="register" googleEnabled={!!process.env.GOOGLE_CLIENT_ID} />
    </Suspense>
  );
}
