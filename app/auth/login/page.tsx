import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="text-sm text-grey-600">
        Enter your email and password to access the portal.
      </p>
      <LoginForm />
      <p className="text-center text-sm text-grey-600">
        Applying for a position?{" "}
        <a href="/auth/register" className="text-navy-900 underline">
          Create an applicant account
        </a>
      </p>
    </div>
  );
}