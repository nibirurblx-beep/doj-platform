"use client";

import { useActionState, useState } from "react";
import { convertApplicantAction } from "@/app/portal/employment/applications/convert-actions";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

interface Org {
  id: string;
  name: string;
}
interface Role {
  id: string;
  name: string;
  organisation_id: string | null;
}
interface Office {
  id: string;
  name: string;
  organisation_id: string;
}

export function ConvertForm({
  applicationId,
  organisations,
  roles,
  offices,
  defaultOrganisationId,
}: {
  applicationId: string;
  organisations: Org[];
  roles: Role[];
  offices: Office[];
  defaultOrganisationId: string;
}) {
  const [selectedOrg, setSelectedOrg] = useState(
    defaultOrganisationId || organisations[0]?.id || "",
  );

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => convertApplicantAction(formData),
    null,
  );

  // Org-scoped roles only: global roles (platform admin) are never offered.
  const orgRoles = roles.filter((r) => r.organisation_id === selectedOrg);
  const orgOffices = offices.filter((o) => o.organisation_id === selectedOrg);

  if (state?.success) {
    return (
      <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />

      <div>
        <label htmlFor="organisationId" className="block text-sm font-medium">
          Organisation
        </label>
        <select
          id="organisationId"
          name="organisationId"
          required
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="roleId" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="roleId"
          name="roleId"
          required
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          {orgRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="officeId" className="block text-sm font-medium">
          Division/Team <span className="text-grey-500">(optional)</span>
        </label>
        <select
          id="officeId"
          name="officeId"
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        >
          <option value="">No division</option>
          {orgOffices.map((office) => (
            <option key={office.id} value={office.id}>
              {office.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="rank" className="block text-sm font-medium">
          Rank <span className="text-grey-500">(optional)</span>
        </label>
        <input
          id="rank"
          name="rank"
          type="text"
          maxLength={80}
          className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
      </div>

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
        {isPending ? "Converting…" : "Create employee"}
      </button>
    </form>
  );
}
