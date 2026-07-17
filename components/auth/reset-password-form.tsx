"use client";

import { resetPasswordAction } from "@/app/auth/actions";
import { useActionState } from "react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    (formData: FormData) => {
      formData.append("token", token);
      return resetPasswordAction(formData);
    },
    null,
  );

  if (state?.success) {
    return (
      <div className="space-y-4 rounded border border-gold-200 bg-gold-50 p-6">
        <h2 className="font-medium">Password reset successful</h2>
        <p className="text-sm text-grey-700">
          Your password has been updated. You can now sign in with your new
          password.
        </p>
        <p className="text-sm">
          <Link href="/login" className="text-navy-900 hover:underline">
            Sign in now
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
        <label htmlFor="password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="mt-1 w-full rounded border border-grey-200 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-opacity-50"
        />
        <p className="mt-1 text-xs text-grey-500">Minimum 8 characters</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-navy-900 px-4 py-2 font-medium text-white hover:bg-navy-950 disabled:opacity-50"
      >
        {isPending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
