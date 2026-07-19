"use client";

import { useActionState, useState } from "react";
import {
  grantRoleAction,
  revokeRoleAction,
  suspendUserAction,
  unsuspendUserAction,
  createDivisionAction,
  updateUserAction,
  setMembershipDivisionAction,
  deleteUserAction,
} from "./actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

interface Option {
  id: string;
  name: string;
  organisationId?: string | null;
  isGlobal?: boolean;
}

export function GrantRoleForm({
  userId,
  organisations,
  roles,
}: {
  userId: string;
  organisations: Option[];
  roles: Option[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => grantRoleAction(formData),
    null,
  );
  const [orgId, setOrgId] = useState("");
  const options = roles.filter((r) => r.isGlobal || r.organisationId === orgId);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="organisationId"
        required
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        className="rounded border border-grey-300 px-2 py-1.5 text-xs"
      >
        <option value="">Organisation…</option>
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select
        name="roleId"
        required
        disabled={!orgId}
        className="rounded border border-grey-300 px-2 py-1.5 text-xs disabled:bg-grey-050"
      >
        <option value="">Role…</option>
        {options.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.isGlobal ? " (global)" : ""}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending || !orgId}
        className="rounded bg-navy-900 px-2.5 py-1.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "…" : "Grant"}
      </button>
      {state?.error && <span className="text-xs text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-xs text-green-700">{state.message}</span>
      )}
    </form>
  );
}

export function RevokeRoleButton({
  membershipId,
  roleId,
}: {
  membershipId: string;
  roleId: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => revokeRoleAction(formData),
    null,
  );
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="roleId" value={roleId} />
      <button
        type="submit"
        disabled={isPending}
        className="ml-1 rounded px-1 text-xs text-grey-500 hover:text-red-800 disabled:opacity-50"
        title={state?.error ?? "Revoke role"}
        aria-label="Revoke role"
      >
        ✕
      </button>
    </form>
  );
}

export function SuspendControls({
  userId,
  isSuspended,
}: {
  userId: string;
  isSuspended: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) =>
      isSuspended ? unsuspendUserAction(formData) : suspendUserAction(formData),
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (isSuspended) {
    return (
      <form action={formAction} className="inline">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-green-700 hover:text-green-700 disabled:opacity-50"
          title={state?.error}
        >
          {isPending ? "…" : "Unsuspend"}
        </button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:text-red-800"
      >
        Suspend
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input
        type="text"
        name="reason"
        placeholder="Reason"
        className="w-32 rounded border border-grey-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-red-800 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
        title={state?.error}
      >
        {isPending ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded px-1.5 py-1 text-xs text-grey-500 hover:text-grey-800"
      >
        Cancel
      </button>
    </form>
  );
}

export function CreateDivisionForm({ organisations }: { organisations: Option[] }) {
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

// ----------------------------------------------------------------------------
// Edit user info
// ----------------------------------------------------------------------------
export function EditUserPanel({
  userId,
  displayName,
  robloxUsername,
  email,
}: {
  userId: string;
  displayName: string;
  robloxUsername: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => updateUserAction(formData),
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-grey-300 px-2 py-1 text-xs hover:border-navy-900"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-2 w-full space-y-2 rounded border border-grey-200 bg-grey-050 p-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">Display name</span>
          <input
            name="displayName"
            defaultValue={displayName}
            required
            className="w-full rounded border border-grey-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">Roblox username</span>
          <input
            name="robloxUsername"
            defaultValue={robloxUsername}
            className="w-full rounded border border-grey-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-grey-600">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            className="w-full rounded border border-grey-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-navy-900 px-3 py-1.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1.5 text-xs text-grey-600 hover:text-grey-900"
        >
          Close
        </button>
        {state?.error && <span className="text-xs text-red-800">{state.error}</span>}
        {state?.success && (
          <span className="text-xs text-green-700">{state.message}</span>
        )}
      </div>
    </form>
  );
}

// ----------------------------------------------------------------------------
// Division select per membership
// ----------------------------------------------------------------------------
export function MembershipDivisionSelect({
  membershipId,
  organisationId,
  currentOfficeId,
  divisions,
}: {
  membershipId: string;
  organisationId: string;
  currentOfficeId: string | null;
  divisions: Option[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => setMembershipDivisionAction(formData),
    null,
  );
  const options = divisions.filter((d) => d.organisationId === organisationId);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="membershipId" value={membershipId} />
      <select
        name="officeId"
        defaultValue={currentOfficeId ?? ""}
        className="rounded border border-grey-300 px-2 py-1 text-xs"
        title={state?.error}
      >
        <option value="">No division</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
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

// ----------------------------------------------------------------------------
// Delete user (permanent, double confirm)
// ----------------------------------------------------------------------------
export function DeleteUserButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteUserAction(formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        const typed = prompt(
          `This permanently deletes ${email}, including their employee records, memberships and applications. Type DELETE to confirm.`,
        );
        if (typed !== "DELETE") e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-grey-300 px-2 py-1 text-xs text-grey-700 hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
        title={state?.error}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}
