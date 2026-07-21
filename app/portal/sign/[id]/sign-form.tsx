"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signDocumentAction } from "../actions";

type ActionResult = { error?: string; success?: boolean } | null;

export function SignForm({
  requestId,
  children,
}: {
  requestId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      const result = await signDocumentAction(formData);
      if (result?.success) router.refresh();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="requestId" value={requestId} />
      {children}
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Signing…" : "Sign document"}
      </button>
      <p className="text-xs text-grey-500">
        By clicking Sign document you confirm the drawn signature is yours and
        you agree to the document&rsquo;s contents.
      </p>
    </form>
  );
}
