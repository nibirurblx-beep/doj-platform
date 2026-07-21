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

  const [createEmployee, setCreateEmployee] = useState(false);

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

      <div className="rounded border border-grey-200 bg-grey-050 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="createEmployee"
            checked={createEmployee}
            onChange={(e) => setCreateEmployee(e.target.checked)}
          />
          Also create an employee record when they activate
        </label>
        {createEmployee && (
          <div className="mt-2">
            <label htmlFor="invite-rank" className="block text-sm">
              Rank <span className="text-grey-500">(optional)</span>
            </label>
            <input
              id="invite-rank"
              name="employeeRank"
              maxLength={100}
              placeholder="e.g. Special Agent"
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-grey-500">
              On activation they get a membership, the chosen role, and an
              employee number in one step — no separate Add employee needed.
            </p>
          </div>
        )}
      </div>

      {state && "error" in state && state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state && "success" in state && state.success && (
        <div
          className={`rounded px-3 py-2 text-sm ${
            state.emailSent === false
              ? "bg-amber-50 text-amber-900"
              : "bg-green-50 text-green-800"
          }`}
        >
          <p>{state.message}</p>
          {state.activationUrl && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-white px-2 py-1 text-xs">
                {state.activationUrl}
              </code>
              <CopyLinkButton url={state.activationUrl} />
            </div>
          )}
          {state.emailSent === false && (
            <p className="mt-1.5 text-xs">
              Send it to the right person only: the link creates their staff
              account with the role you chose, works once, and expires in 7
              days.
            </p>
          )}
        </div>
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

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable: the link is selectable next to the button
        }
      }}
      className="rounded border border-grey-300 bg-white px-2.5 py-1 text-xs hover:border-navy-900"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}
