import type { Metadata } from "next";
import { ActivateForm } from "@/components/auth/activate-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Activate account" };

export default async function ActivatePage({
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
        <h1 className="font-display text-xl">Invalid activation link</h1>
        <p className="text-sm text-grey-700">
          The activation link is missing or invalid. Please check your email
          and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Activate your account</h1>
      <p className="text-sm text-grey-600">
        Set a password and complete your profile to get started.
      </p>
      <ActivateForm token={token} />
    </div>
  );
}
