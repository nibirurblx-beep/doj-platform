"use client";

import { activateAccountAction } from "@/app/auth/actions";
import { useActionState } from "react";

export function ActivateForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return activateAccountAction(token, formData);
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded border-l-4 border-signal-red bg-red-50 p-4">
          <p className="text-sm text-signal-red">{state.error}</p>
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          placeholder="e.g. Jane Smith"
          className="mt-1 w-full rounded border border-grey-200 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-opacity-50"
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
          placeholder="Your Roblox username"
          className="mt-1 w-full rounded border border-grey-200 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-opacity-50"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
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
        {isPending ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}
