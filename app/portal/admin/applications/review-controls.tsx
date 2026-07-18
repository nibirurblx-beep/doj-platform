"use client";

import { useActionState } from "react";
import {
  changeApplicationStatusAction,
  addApplicationNoteAction,
} from "@/app/portal/admin/applications/actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function StatusControls({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => changeApplicationStatusAction(formData),
    null,
  );

  const buttons: Array<{ value: string; label: string; cls: string }> = [];
  if (status === "submitted") {
    buttons.push({
      value: "under_review",
      label: "Start review",
      cls: "bg-navy-900 text-white hover:bg-navy-800",
    });
  }
  if (status === "submitted" || status === "under_review") {
    buttons.push(
      {
        value: "accepted",
        label: "Accept",
        cls: "bg-green-700 text-white hover:bg-green-800",
      },
      {
        value: "rejected",
        label: "Reject",
        cls: "border border-grey-300 bg-white hover:border-red-800 hover:text-red-800",
      },
    );
  }
  if (status === "rejected") {
    buttons.push({
      value: "under_review",
      label: "Reopen review",
      cls: "border border-grey-300 bg-white hover:border-navy-900",
    });
  }

  if (buttons.length === 0) {
    return (
      <p className="text-sm text-grey-600">
        No further actions available for this application.
      </p>
    );
  }

  return (
    <div>
      {state?.error && (
        <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={applicationId} />
        {buttons.map((b) => (
          <button
            key={b.value}
            type="submit"
            name="status"
            value={b.value}
            disabled={isPending}
            className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
      </form>
    </div>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => addApplicationNoteAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <textarea
        name="body"
        rows={3}
        required
        maxLength={5000}
        placeholder="Add an internal note (never visible to the applicant)…"
        className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        key={state?.success ? Date.now() : "note"}
      />
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add note"}
      </button>
    </form>
  );
}
