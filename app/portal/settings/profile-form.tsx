"use client";

import { useActionState } from "react";
import { updateOwnProfileAction } from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function ProfileForm({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => updateOwnProfileAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="settings-name" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="settings-name"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={80}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="settings-email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="settings-email"
          name="email"
          type="email"
          defaultValue={email}
          required
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="settings-password" className="block text-sm font-medium">
          Current password{" "}
          <span className="font-normal text-grey-500">
            (only needed when changing your email)
          </span>
        </label>
        <input
          id="settings-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
