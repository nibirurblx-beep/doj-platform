"use client";

import { useActionState } from "react";
import { createTemplateAction, deleteTemplateAction } from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function CreateTemplateForm({
  organisations,
}: {
  organisations: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => createTemplateAction(formData),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-grey-600">Organisation</span>
          <select
            name="organisationId"
            required
            className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
          >
            <option value="">Choose…</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-grey-600">Template name</span>
          <input
            name="name"
            required
            placeholder="e.g. Standard NDA"
            className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-grey-600">Description (optional)</span>
        <input
          name="description"
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-grey-600">Master PDF (15 MB max)</span>
        <input type="file" name="file" accept="application/pdf" required className="text-sm" />
      </label>
      {state?.error && <p className="text-sm text-red-800">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "Create and place fields"}
      </button>
    </form>
  );
}

export function DeleteTemplateButton({
  templateId,
  name,
}: {
  templateId: string;
  name: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteTemplateAction(formData),
    null,
  );
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Delete template "${name}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-red-800 hover:text-red-800 disabled:opacity-50"
      >
        {isPending ? "…" : "Delete"}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-800">{state.error}</span>}
    </form>
  );
}
