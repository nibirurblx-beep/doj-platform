"use client";

import { useActionState, useState } from "react";
import {
  createOrganisationAction,
  renameOrganisationAction,
  deleteOrganisationAction,
  renameDivisionAction,
  deleteDivisionAction,
  createDivisionAction,
} from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function CreateOrganisationForm() {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => createOrganisationAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="mb-0.5 block text-grey-600">Name</span>
        <input
          name="name"
          required
          placeholder="e.g. Department of Homeland Security"
          className="w-72 rounded border border-grey-300 px-3 py-1.5 text-sm"
          key={state?.success ? `n${Date.now()}` : "name"}
        />
      </label>
      <label className="text-xs">
        <span className="mb-0.5 block text-grey-600">
          Slug (permanent — used in employee numbers and folders)
        </span>
        <input
          name="slug"
          required
          placeholder="e.g. dhs"
          pattern="[a-z0-9-]+"
          className="w-40 rounded border border-grey-300 px-3 py-1.5 text-sm"
          key={state?.success ? `s${Date.now()}` : "slug"}
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create organisation"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}

export function RenameForm({
  id,
  currentName,
  kind,
}: {
  id: string;
  currentName: string;
  kind: "organisation" | "division";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) =>
      kind === "organisation"
        ? renameOrganisationAction(formData)
        : renameDivisionAction(formData),
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900"
      >
        Rename
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        type="hidden"
        name={kind === "organisation" ? "organisationId" : "officeId"}
        value={id}
      />
      <input
        name="name"
        defaultValue={currentName}
        required
        className="w-56 rounded border border-grey-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {isPending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-1 text-xs text-grey-500 hover:text-grey-800"
      >
        Cancel
      </button>
      {state?.error && <span className="text-xs text-red-800">{state.error}</span>}
    </form>
  );
}

export function DeleteEntityButton({
  id,
  name,
  kind,
}: {
  id: string;
  name: string;
  kind: "organisation" | "division";
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) =>
      kind === "organisation"
        ? deleteOrganisationAction(formData)
        : deleteDivisionAction(formData),
    null,
  );

  const confirmText =
    kind === "organisation"
      ? `Delete the organisation "${name}"? Only possible when it has no members, employees, vacancies or invitations. Type DELETE to confirm.`
      : `Delete the division "${name}"? Members assigned to it will simply have no division. Continue?`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <form
        action={formAction}
        className="inline"
        onSubmit={(e) => {
          if (kind === "organisation") {
            if (prompt(confirmText) !== "DELETE") e.preventDefault();
          } else if (!confirm(confirmText)) {
            e.preventDefault();
          }
        }}
      >
        <input
          type="hidden"
          name={kind === "organisation" ? "organisationId" : "officeId"}
          value={id}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
        >
          {isPending ? "…" : "Delete"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-red-800">{state.error}</span>}
    </span>
  );
}

export function CreateDivisionInline({
  organisations,
}: {
  organisations: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => createDivisionAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="organisationId"
        required
        className="rounded border border-grey-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Organisation…</option>
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="name"
        required
        placeholder="e.g. United States Attorney's Office"
        className="w-72 rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? Date.now() : "name"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create division"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}
