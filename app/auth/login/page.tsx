import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/portal");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="text-sm text-grey-600">
        Enter your email and password to access the portal.
      </p>
      <LoginForm />
    </div>
  );
}
