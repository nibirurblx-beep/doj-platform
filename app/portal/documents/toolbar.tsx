"use client";

import { useActionState, useState } from "react";
import {
  uploadDocumentAction,
  createFolderAction,
  deleteDocumentAction,
  deleteFolderAction,
  setFolderRestrictedAction,
  addFolderMemberAction,
  removeFolderMemberAction,
  addResourceLinkAction,
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

export function FolderAccessControl({
  path,
  rule,
  staff,
}: {
  path: string;
  rule: { memberCount: number; members: Array<{ id: string; name: string }> } | null;
  staff: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [restrictState, restrictAction, isRestricting] = useActionState<
    ActionResult,
    FormData
  >(async (_prev, formData) => setFolderRestrictedAction(formData), null);
  const [addState, addAction, isAdding] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => addFolderMemberAction(formData),
    null,
  );
  const [, removeAction, isRemoving] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => removeFolderMemberAction(formData),
    null,
  );

  const memberIds = new Set((rule?.members ?? []).map((m) => m.id));
  const addable = staff.filter((person) => !memberIds.has(person.id));

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        {rule ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900"
          >
            {open ? "Close" : "Manage access"}
          </button>
        ) : (
          <form action={restrictAction} className="inline">
            <input type="hidden" name="path" value={path} />
            <input type="hidden" name="restricted" value="true" />
            <button
              type="submit"
              disabled={isRestricting}
              className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900 disabled:opacity-50"
              title="Only people you assign will see this folder"
            >
              {isRestricting ? "…" : "Restrict"}
            </button>
          </form>
        )}
        {restrictState?.error && (
          <span className="text-xs text-red-800">{restrictState.error}</span>
        )}
      </span>

      {rule && open && (
        <span className="block w-72 rounded border border-grey-200 bg-grey-050 p-2.5">
          <span className="block text-xs font-medium text-grey-600">
            Who can access this folder
          </span>
          <span className="mt-1.5 block space-y-1">
            {(rule.members ?? []).map((member) => (
              <form
                key={member.id}
                action={removeAction}
                className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1"
              >
                <input type="hidden" name="path" value={path} />
                <input type="hidden" name="userId" value={member.id} />
                <span className="truncate text-xs">{member.name}</span>
                <button
                  type="submit"
                  disabled={isRemoving}
                  className="text-xs text-grey-400 hover:text-red-800 disabled:opacity-50"
                  title="Remove access"
                >
                  ✕
                </button>
              </form>
            ))}
          </span>
          {addable.length > 0 && (
            <form action={addAction} className="mt-2 flex items-center gap-1.5">
              <input type="hidden" name="path" value={path} />
              <select
                name="userId"
                required
                className="min-w-0 flex-1 rounded border border-grey-300 px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="" disabled>
                  Add a person…
                </option>
                {addable.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isAdding}
                className="rounded bg-navy-900 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {isAdding ? "…" : "Add"}
              </button>
            </form>
          )}
          {addState?.error && (
            <span className="mt-1 block text-xs text-red-800">{addState.error}</span>
          )}
          <form action={restrictAction} className="mt-2 block">
            <input type="hidden" name="path" value={path} />
            <input type="hidden" name="restricted" value="false" />
            <button
              type="submit"
              disabled={isRestricting}
              className="text-xs text-grey-500 underline hover:text-navy-900 disabled:opacity-50"
            >
              Open to all staff (remove restriction)
            </button>
          </form>
        </span>
      )}
    </span>
  );
}

export function AddResourceForm({ folder }: { folder: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => addResourceLinkAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="folder" value={folder} />
      <input
        type="text"
        name="name"
        required
        placeholder="Resource name"
        className="w-40 rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? `n${Date.now()}` : "name"}
      />
      <input
        type="url"
        name="url"
        required
        placeholder="https://…"
        className="w-56 rounded border border-grey-300 px-3 py-1.5 text-sm"
        key={state?.success ? `u${Date.now()}` : "url"}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add resource"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}
