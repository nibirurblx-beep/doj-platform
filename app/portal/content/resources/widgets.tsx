"use client";

import { useActionState } from "react";
import { uploadPublicResourceAction, deletePublicResourceAction, addResourceLinkAction } from "./actions";

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

export function ResourceLinkForm() {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => addResourceLinkAction(formData),
    null,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="name"
        required
        placeholder="Link name (e.g. Motion template - Google Docs)"
        className="w-72 rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? `n${Date.now()}` : "name"}
      />
      <input
        type="url"
        name="url"
        required
        placeholder="https://…"
        className="w-72 rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? `u${Date.now()}` : "url"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 bg-white px-4 py-2 text-sm hover:border-navy-900 disabled:opacity-50"
      >
        {isPending ? "Publishing…" : "Publish link"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}
