"use client";

import { useActionState } from "react";
import { unlinkDiscordAction } from "./actions";

type ActionResult = { error?: string; success?: boolean } | null;

export function UnlinkDiscordButton() {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async () => unlinkDiscordAction(),
    null,
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 bg-white px-4 py-2 text-sm hover:border-red-800 hover:text-red-800 disabled:opacity-50"
        title={state?.error}
      >
        {isPending ? "Removing…" : "Disconnect"}
      </button>
    </form>
  );
}
