import { createSupabaseServiceClient } from "@/lib/db/server";
import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "@/components/admin/revoke-button";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function invitationStatus(inv: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): { label: string; tone: string } {
  if (inv.accepted_at) return { label: "Accepted", tone: "text-green-700 bg-green-50" };
  if (inv.revoked_at) return { label: "Revoked", tone: "text-grey-600 bg-grey-100" };
  if (new Date(inv.expires_at) < new Date())
    return { label: "Expired", tone: "text-red-800 bg-red-50" };
  return { label: "Pending", tone: "text-navy-900 bg-blue-50" };
}

export default async function InvitationsPage() {
  const service = createSupabaseServiceClient();

  // Organisations where THIS user can invite (drives the form's org dropdown)
  const myPermissions = await getMyPermissions();
  const invitableOrgIds = myPermissions
    .filter((p) => p.permission_key === PERMISSIONS.USERS_INVITE)
    .map((p) => p.organisation_id);

  const [orgsResult, rolesResult, officesResult, invitationsResult] =
    await Promise.all([
      service
        .from("organisations")
        .select("id, slug, name")
        .in("id", invitableOrgIds)
        .order("name"),
      service
        .from("roles")
        .select("id, name, organisation_id")
        .order("name"),
      service
        .from("offices")
        .select("id, name, organisation_id")
        .order("name"),
      service
        .from("invitations")
        .select(
          "id, email, organisation_id, invited_at, expires_at, accepted_at, revoked_at, organisations(name), roles(name)",
        )
        .in("organisation_id", invitableOrgIds)
        .order("invited_at", { ascending: false })
        .limit(50),
    ]);

  const organisations = orgsResult.data ?? [];
  // Roles usable in the form: org-specific ones plus global roles (organisation_id null)
  const roles = (rolesResult.data ?? []).filter(
    (r) => r.organisation_id === null || invitableOrgIds.includes(r.organisation_id),
  );
  const offices = (officesResult.data ?? []).filter((o) =>
    invitableOrgIds.includes(o.organisation_id),
  );
  const invitations = invitationsResult.data ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded border border-grey-200 bg-white p-5">
        <h3 className="font-display text-lg">Send an invitation</h3>
        <p className="mt-1 text-sm text-grey-600">
          The recipient gets an email with a one-time activation link that
          expires in 7 days. Accounts are invitation-only.
        </p>
        <div className="mt-4">
          <InviteForm
            organisations={organisations}
            roles={roles}
            offices={offices}
          />
        </div>
      </section>

      <section className="rounded border border-grey-200 bg-white">
        <div className="border-b border-grey-200 px-5 py-4">
          <h3 className="font-display text-lg">Recent invitations</h3>
        </div>
        {invitations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            No invitations yet. Send the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 text-left text-grey-600">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Organisation</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Invited</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const status = invitationStatus(inv);
                  const canRevoke = status.label === "Pending";
                  // Supabase nested selects come back as objects here
                  const orgName =
                    (inv.organisations as unknown as { name: string } | null)
                      ?.name ?? "—";
                  const roleName =
                    (inv.roles as unknown as { name: string } | null)?.name ??
                    "—";
                  return (
                    <tr key={inv.id} className="border-b border-grey-100">
                      <td className="px-5 py-3">{inv.email}</td>
                      <td className="px-5 py-3">{orgName}</td>
                      <td className="px-5 py-3">{roleName}</td>
                      <td className="px-5 py-3">{formatDate(inv.invited_at)}</td>
                      <td className="px-5 py-3">{formatDate(inv.expires_at)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${status.tone}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canRevoke && <RevokeButton invitationId={inv.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
