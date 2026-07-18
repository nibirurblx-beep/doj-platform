import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Create an applicant account</h1>
        <p className="mt-1 text-sm text-grey-600">
          Apply for open positions and track your applications. Staff accounts
          are created by invitation only.
        </p>
      </div>
      <RegisterForm next={next} />
    </div>
  );
}
