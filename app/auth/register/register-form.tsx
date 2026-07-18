"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerApplicantAction } from "./actions";

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      formData.set("next", next);
      return registerApplicantAction(formData);
    },
    null,
  );

  if (state && "success" in state && state.success && state.needsConfirmation) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-5">
        <p className="text-sm text-green-800">{state.message}</p>
        <Link
          href="/auth/login"
          className="mt-3 inline-block text-sm text-navy-900 underline"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={80}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password <span className="text-grey-500">(minimum 8 characters)</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="robloxUsername" className="block text-sm font-medium">
          Roblox username <span className="text-grey-500">(optional)</span>
        </label>
        <input
          id="robloxUsername"
          name="robloxUsername"
          type="text"
          maxLength={50}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      {state && "error" in state && state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-navy-900 px-4 py-2.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-grey-600">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-navy-900 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
