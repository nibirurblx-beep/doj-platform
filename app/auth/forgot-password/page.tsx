import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/portal");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Forgot password</h1>
      <p className="text-sm text-grey-600">
        Enter your email address and we'll send you a link to reset your
        password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
