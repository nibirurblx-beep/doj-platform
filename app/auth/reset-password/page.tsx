import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/portal");
  }

  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4 rounded border border-signal-red bg-red-50 p-6">
        <h1 className="font-display text-xl">Invalid reset link</h1>
        <p className="text-sm text-grey-700">
          The reset link is missing, invalid, or expired. Please request a new
          one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Reset your password</h1>
      <p className="text-sm text-grey-600">
        Enter a new password below. The link expires in 15 minutes.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
