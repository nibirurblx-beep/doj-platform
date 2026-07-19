"use client";

import { useActionState } from "react";
import {
  uploadDocumentAction,
  createFolderAction,
  deleteDocumentAction,
  deleteFolderAction,
  setFolderVisibilityAction,
} from "@/app/portal/documents/actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function UploadForm({ folder }: { folder: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => uploadDocumentAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="folder" value={folder} />
      <input
        type="file"
        name="file"
        required
        className="text-sm file:mr-2 file:rounded file:border file:border-grey-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
        key={state?.success ? Date.now() : "file"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "Upload"}
      </button>
      {state?.error && (
        <span className="text-sm text-red-800">{state.error}</span>
      )}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}

export function NewFolderForm({ folder }: { folder: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => createFolderAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="folder" value={folder} />
      <input
        type="text"
        name="name"
        required
        placeholder="New folder name"
        className="rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? Date.now() : "name"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create folder"}
      </button>
      {state?.error && (
        <span className="text-sm text-red-800">{state.error}</span>
      )}
    </form>
  );
}

export function DeleteButton({ path }: { path: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteDocumentAction(formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm("Delete this file? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:text-red-800 disabled:opacity-50"
        title={state?.error}
      >
        {isPending ? "…" : "Delete"}
      </button>
    </form>
  );
}

export function DeleteFolderButton({ path }: { path: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteFolderAction(formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm("Delete this folder? Only empty folders can be deleted.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:text-red-800 disabled:opacity-50"
        title={state?.error ?? "Delete empty folder"}
      >
        {isPending ? "…" : "Delete"}
      </button>
      {state?.error && (
        <span className="ml-1.5 text-xs text-red-800">{state.error}</span>
      )}
    </form>
  );
}

export function FolderVisibilityControl({
  path,
  currentOrgId,
  organisations,
}: {
  path: string;
  currentOrgId: string | null;
  organisations: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => setFolderVisibilityAction(formData),
    null,
  );

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="path" value={path} />
      <select
        name="orgId"
        defaultValue={currentOrgId ?? ""}
        className="rounded border border-grey-300 px-2 py-1 text-xs"
        title="Who can see this folder"
      >
        <option value="">All staff</option>
        {organisations.map((org) => (
          <option key={org.id} value={org.id}>
            Private to {org.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900 disabled:opacity-50"
      >
        {isPending ? "…" : "Set"}
      </button>
      {state?.success && <span className="text-xs text-green-700">✓</span>}
      {state?.error && <span className="text-xs text-red-800">{state.error}</span>}
    </form>
  );
}
