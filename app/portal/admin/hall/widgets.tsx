"use client";

import { useActionState, useState } from "react";
import {
  saveAttorneyGeneralAction,
  deleteAttorneyGeneralAction,
} from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export interface AgRow {
  id: string;
  ordinal: number;
  name: string;
  term_start: string;
  term_end: string | null;
  bio: string | null;
  photo_url: string | null;
}

export function AgForm({
  existing,
  onDone,
}: {
  existing?: AgRow;
  onDone?: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      const result = await saveAttorneyGeneralAction(formData);
      if (result?.success && onDone) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">
            Ordinal (1 = first Attorney General)
          </span>
          <input
            type="number"
            name="ordinal"
            min={1}
            required
            defaultValue={existing?.ordinal}
            className="w-full rounded border border-grey-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">Name</span>
          <input
            name="name"
            required
            defaultValue={existing?.name}
            className="w-full rounded border border-grey-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">Term start</span>
          <input
            type="date"
            name="termStart"
            required
            defaultValue={existing?.term_start}
            className="w-full rounded border border-grey-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">
            Term end (blank = incumbent)
          </span>
          <input
            type="date"
            name="termEnd"
            defaultValue={existing?.term_end ?? ""}
            className="w-full rounded border border-grey-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-0.5 block text-grey-600">Short bio (optional)</span>
        <textarea
          name="bio"
          rows={3}
          maxLength={2000}
          defaultValue={existing?.bio ?? ""}
          placeholder="Notable achievements, era, cases…"
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-0.5 block text-grey-600">
          Portrait (JPG/PNG/WebP, 2 MB max{existing?.photo_url ? " — replaces current" : ""})
        </span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="text-xs" />
      </label>
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : existing ? "Save changes" : "Add to the hall"}
      </button>
    </form>
  );
}

export function AgListItem({ ag }: { ag: AgRow }) {
  const [editing, setEditing] = useState(false);
  const [state, deleteAction, isDeleting] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteAttorneyGeneralAction(formData),
    null,
  );

  return (
    <div className="rounded border border-grey-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {ag.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ag.photo_url}
              alt={ag.name}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-navy-900 font-display text-white">
              {ag.ordinal}
            </div>
          )}
          <div>
            <p className="text-sm font-medium">
              {ag.name}{" "}
              <span className="text-grey-500">
                · {ordinalLabel(ag.ordinal)} Attorney General
              </span>
            </p>
            <p className="text-xs text-grey-500">
              {ag.term_start} — {ag.term_end ?? "present"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <form
            action={deleteAction}
            className="inline"
            onSubmit={(e) => {
              if (!confirm(`Remove ${ag.name} from the hall?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={ag.id} />
            <button
              type="submit"
              disabled={isDeleting}
              className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-red-800 hover:text-red-800 disabled:opacity-50"
            >
              {isDeleting ? "…" : "Delete"}
            </button>
          </form>
        </div>
      </div>
      {state?.error && <p className="mt-2 text-xs text-red-800">{state.error}</p>}
      {editing && (
        <div className="mt-4 border-t border-grey-100 pt-4">
          <AgForm existing={ag} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

export function ordinalLabel(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}
