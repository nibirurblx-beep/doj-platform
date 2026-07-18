"use client";

import { useActionState, useState } from "react";
import { createInvitationAction } from "./actions";

interface Organisation {
  id: string;
  slug: string;
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

export function InviteForm({
  organisations,
  roles,
  offices,
}: {
  organisations: Organisation[];
  roles: Role[];
  offices: Office[];
}) {
  const [selectedOrg, setSelectedOrg] = useState<string>(
    organisations[0]?.id ?? "",
  );

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return createInvitationAction(formData);
    },
    null,
  );

  const orgRoles = roles.filter(
    (r) => r.organisation_id === null || r.organisation_id === selectedOrg,
  );
  const orgOffices = offices.filter((o) => o.organisation_id === selectedOrg);

  if (organisations.length === 0) {
    return (
      <p className="text-sm text-grey-600">
        You do not hold invitation permission in any organisation.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            placeholder="name@example.com"
          />
        </div>

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
                {role.organisation_id === null ? " (global)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="officeId" className="block text-sm font-medium">
            Office <span className="text-grey-500">(optional)</span>
          </label>
          <select
            id="officeId"
            name="officeId"
            className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
          >
            <option value="">No office</option>
            {orgOffices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="robloxUsername" className="block text-sm font-medium">
            Roblox username <span className="text-grey-500">(optional)</span>
          </label>
          <input
            id="robloxUsername"
            name="robloxUsername"
            type="text"
            className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="discordUsername" className="block text-sm font-medium">
            Discord username <span className="text-grey-500">(optional)</span>
          </label>
          <input
            id="discordUsername"
            name="discordUsername"
            type="text"
            className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state && "error" in state && state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state && "success" in state && state.success && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
