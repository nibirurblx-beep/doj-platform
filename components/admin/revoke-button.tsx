"use client";

import { useActionState } from "react";
import { revokeInvitationAction } from "@/app/portal/admin/invitations/actions";

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return revokeInvitationAction(formData);
    },
    null,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:text-red-800 disabled:opacity-50"
        title={state && "error" in state && state.error ? state.error : undefined}
      >
        {isPending ? "Revoking…" : "Revoke"}
      </button>
    </form>
  );
}
