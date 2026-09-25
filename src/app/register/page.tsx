import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell title="Create your account" description="Start auditing websites with deterministic scoring and evidence-backed findings.">
      <RegisterForm />
    </AuthShell>
  );
}
