"use client";

import { forgotPasswordAction } from "@/app/auth/actions";
import { useActionState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return forgotPasswordAction(formData);
    },
    null,
  );

  if (state?.success) {
    return (
      <div className="space-y-4 rounded border border-gold-200 bg-gold-50 p-6">
        <h2 className="font-medium">Check your email</h2>
        <p className="text-sm text-grey-700">
          If an account exists with that email address, we've sent a password
          reset link. The link expires in 15 minutes.
        </p>
        <p className="text-sm">
          <Link href="/login" className="text-navy-900 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded border-l-4 border-signal-red bg-red-50 p-4">
          <p className="text-sm text-signal-red">{state.error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-grey-200 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-navy-900 px-4 py-2 font-medium text-white hover:bg-navy-950 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-navy-900 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
