"use client";

import { useActionState } from "react";
import {
  addEmployeeAction,
  toggleChecklistAction,
  uploadEmployeeFileAction,
  deleteEmployeeFileAction,
} from "./actions";
import { CHECKLIST_ITEMS, type ChecklistState } from "@/lib/employees/checklist";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

// ----------------------------------------------------------------------------
// Pre-employment checklist
// ----------------------------------------------------------------------------
export function Checklist({
  employeeId,
  state,
  canEdit,
  nameById,
}: {
  employeeId: string;
  state: ChecklistState;
  canEdit: boolean;
  nameById: Record<string, string>;
}) {
  const [result, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => toggleChecklistAction(formData),
    null,
  );

  const doneCount = CHECKLIST_ITEMS.filter((i) => state[i.key]?.done).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Pre-employment checklist</h2>
        <span className="text-sm text-grey-600">
          {doneCount} of {CHECKLIST_ITEMS.length} complete
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded bg-grey-100">
        <div
          className="h-1.5 rounded bg-gold-600 transition-all"
          style={{ width: `${(doneCount / CHECKLIST_ITEMS.length) * 100}%` }}
        />
      </div>
      {result?.error && (
        <p className="mt-2 text-sm text-red-800">{result.error}</p>
      )}
      <ul className="mt-4 space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const entry = state[item.key];
          const done = entry?.done === true;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <form action={formAction}>
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="itemKey" value={item.key} />
                <button
                  type="submit"
                  disabled={!canEdit || isPending}
                  aria-label={`${done ? "Untick" : "Tick"} ${item.label}`}
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold shadow-sm ${
                    done
                      ? "border-gold-600 bg-gold-600 text-navy-950"
                      : "border-grey-400 bg-grey-050 text-transparent hover:scale-110 hover:border-navy-900 hover:bg-white"
                  } ${canEdit ? "" : "cursor-not-allowed opacity-60"}`}
                >
                  ✓
                </button>
              </form>
              <div>
                <p className={`text-sm ${done ? "text-grey-500 line-through" : ""}`}>
                  {item.label}
                </p>
                {done && entry?.at && (
                  <p className="text-xs text-grey-500">
                    {new Date(entry.at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {entry.by && nameById[entry.by] ? ` by ${nameById[entry.by]}` : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Employee files
// ----------------------------------------------------------------------------
export function EmployeeFileUpload({ employeeId }: { employeeId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => uploadEmployeeFileAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        type="file"
        name="file"
        required
        key={state?.success ? Date.now() : "file"}
        className="text-sm file:mr-2 file:rounded file:border file:border-grey-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "Upload"}
      </button>
      {state?.error && <span className="text-sm text-red-800">{state.error}</span>}
      {state?.success && (
        <span className="text-sm text-green-700">{state.message}</span>
      )}
    </form>
  );
}

export function DeleteEmployeeFileButton({
  employeeId,
  fileName,
}: {
  employeeId: string;
  fileName: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => deleteEmployeeFileAction(formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Delete ${fileName}? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="fileName" value={fileName} />
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

// ----------------------------------------------------------------------------
// Direct add-employee form
// ----------------------------------------------------------------------------
interface Option {
  id: string;
  name: string;
  organisationId?: string | null;
}

export function AddEmployeeForm({
  users,
  organisations,
  roles,
  divisions,
}: {
  users: Array<{ id: string; label: string }>;
  organisations: Option[];
  roles: Option[];
  divisions: Option[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => addEmployeeAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.message}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="add-user">
          User account
        </label>
        <select
          id="add-user"
          name="userId"
          required
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          <option value="">Choose a user…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-grey-500">
          The person needs an account first: invite them as staff, or they can
          register as an applicant.
        </p>
      </div>

      <OrgScopedSelects organisations={organisations} roles={roles} divisions={divisions} />

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="add-rank">
          Rank <span className="font-normal text-grey-500">(optional)</span>
        </label>
        <input
          id="add-rank"
          name="rank"
          maxLength={100}
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
          placeholder="e.g. Special Agent"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create employee"}
      </button>
    </form>
  );
}

import { useState } from "react";

function OrgScopedSelects({
  organisations,
  roles,
  divisions,
}: {
  organisations: Option[];
  roles: Option[];
  divisions: Option[];
}) {
  const [orgId, setOrgId] = useState("");
  const orgRoles = roles.filter((r) => r.organisationId === orgId);
  const orgDivisions = divisions.filter((d) => d.organisationId === orgId);

  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="add-org">
          Organisation
        </label>
        <select
          id="add-org"
          name="organisationId"
          required
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          <option value="">Choose an organisation…</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="add-role">
          Role
        </label>
        <select
          id="add-role"
          name="roleId"
          required
          disabled={!orgId}
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm disabled:bg-grey-050"
        >
          <option value="">
            {orgId ? "Choose a role…" : "Choose an organisation first"}
          </option>
          {orgRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="add-division">
          Division/Team <span className="font-normal text-grey-500">(optional)</span>
        </label>
        <select
          id="add-division"
          name="officeId"
          disabled={!orgId}
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm disabled:bg-grey-050"
        >
          <option value="">
            {orgId
              ? orgDivisions.length
                ? "No division"
                : "No divisions exist for this organisation yet"
              : "Choose an organisation first"}
          </option>
          {orgDivisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
