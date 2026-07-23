"use client";

import { useActionState, useState } from "react";
import { submitFoiRequestAction, appealFoiRequestAction } from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function FoiForm({
  organisations,
}: {
  organisations: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => submitFoiRequestAction(formData),
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
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="foi-org" className="block text-sm font-medium">
          Department or agency
        </label>
        <select
          id="foi-org"
          name="organisationId"
          required
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          <option value="">Choose…</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="foi-description" className="block text-sm font-medium">
          Description of the information requested
        </label>
        <textarea
          id="foi-description"
          name="description"
          required
          rows={6}
          minLength={30}
          maxLength={5000}
          placeholder="Describe the records or information you are requesting, e.g. disciplinary records, department policies, department structure, or an inquiry regarding a previous investigation…"
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
          key={state?.success ? Date.now() : "description"}
        />
        <p className="mt-1 text-xs text-grey-500">
          Be specific: vague or frivolous requests made solely to expend
          government resources may be rejected at the receipt stage.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="statement" required className="mt-0.5" />
        <span>
          I state that this request is made under section 5 of the Freedom of
          Information Act (5 US CODE § 315).
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

export function AppealForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => appealFoiRequestAction(formData),
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-navy-900"
      >
        Appeal this denial
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label className="block text-sm font-medium">
          Grounds for the appeal
        </label>
        <textarea
          name="grounds"
          required
          rows={4}
          minLength={30}
          maxLength={5000}
          placeholder="Explain why the denial was wrong, e.g. why the cited exemption does not apply or why redaction would have sufficed…"
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit appeal"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 text-sm text-grey-500 hover:text-grey-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
