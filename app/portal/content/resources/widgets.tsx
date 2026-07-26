"use client";

import { useActionState } from "react";
import { uploadPublicResourceAction, deletePublicResourceAction } from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function ResourceUploadForm() {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => uploadPublicResourceAction(formData),
    null,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="file"
        required
        accept=".pdf,.doc,.docx,.odt,.rtf,.txt"
        className="text-sm"
        key={state?.success ? Date.now() : "file"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Publishing…" : "Publish resource"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}

export function ResourceDeleteButton({ name }: { name: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deletePublicResourceAction(formData),
    null,
  );
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Remove "${name}" from public resources?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="name" value={name} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-red-800 hover:text-red-800 disabled:opacity-50"
      >
        {isPending ? "…" : "Remove"}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-800">{state.error}</span>}
    </form>
  );
}
