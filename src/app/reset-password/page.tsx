import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  return (
    <AuthShell title="Set a new password" description="Use a strong password and store it securely.">
      {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-rose-400">Reset token is missing.</p>}
    </AuthShell>
  );
}
