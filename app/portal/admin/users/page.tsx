import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import {
  GrantRoleForm,
  RevokeRoleButton,
  SuspendControls,
  CreateDivisionForm,
} from "./widgets";

export const metadata = { title: "Users" };

export default async function UsersAdminPage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    redirect("/portal/admin");
  }

  const service = createSupabaseServiceClient();

  const [usersResult, { data: organisations }, { data: roles }, { data: divisions }] =
    await Promise.all([
      service.auth.admin.listUsers({ page: 1, perPage: 500 }),
      service.from("organisations").select("id, name").order("name"),
      service.from("roles").select("id, name, organisation_id").order("name"),
      service
        .from("offices")
        .select("id, name, organisation_id, organisations(name)")
        .order("name"),
    ]);

  const authUsers = usersResult.data?.users ?? [];
  const userIds = authUsers.map((u) => u.id);

  const [{ data: profiles }, { data: memberships }, { data: statuses }] =
    await Promise.all([
      userIds.length
        ? service.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? service
            .from("memberships")
            .select(
              "id, user_id, organisations(name), membership_roles(id, roles(name))",
            )
            .in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? service
            .from("user_security_status")
            .select("user_id, suspended_at, suspension_reason")
            .in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name] as const));
  const suspendedById = new Map(
    (statuses ?? []).map((s) => [s.user_id, Boolean(s.suspended_at)] as const),
  );
  type MembershipRow = NonNullable<typeof memberships>[number];
  const membershipsByUser = new Map<string, MembershipRow[]>();
  for (const m of memberships ?? []) {
    const list = membershipsByUser.get(m.user_id) ?? [];
    list.push(m);
    membershipsByUser.set(m.user_id, list);
  }

  const users = authUsers
    .map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      name: nameById.get(u.id) ?? "Unnamed",
      suspended: suspendedById.get(u.id) ?? false,
      memberships: membershipsByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Users</h2>
          <span className="text-sm text-grey-600">{users.length} accounts</span>
        </div>
        <p className="mt-1 text-sm text-grey-600">
          Grant or revoke roles and manage suspensions. Granting a role in an
          organisation creates the membership automatically.
        </p>

        <div className="mt-4 space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded border border-grey-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {user.name}
                    {user.suspended && (
                      <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                        Suspended
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-grey-500">{user.email}</p>
                </div>
                <SuspendControls userId={user.id} isSuspended={user.suspended} />
              </div>

              {/* Existing roles */}
              <div className="mt-3 flex flex-wrap gap-2">
                {user.memberships.flatMap((m) => {
                  const orgName =
                    (m.organisations as unknown as { name: string } | null)?.name ?? "?";
                  const roleEntries =
                    (m.membership_roles as unknown as Array<{
                      id: string;
                      roles: { name: string } | null;
                    }>) ?? [];
                  return roleEntries.map((mr) => (
                    <span
                      key={mr.id}
                      className="flex items-center rounded bg-grey-100 px-2 py-1 text-xs"
                    >
                      {mr.roles?.name ?? "?"}
                      <span className="ml-1 text-grey-500">· {orgName}</span>
                      <RevokeRoleButton membershipRoleId={mr.id} />
                    </span>
                  ));
                })}
                {user.memberships.every(
                  (m) =>
                    ((m.membership_roles as unknown as unknown[]) ?? []).length === 0,
                ) && <span className="text-xs text-grey-500">No roles</span>}
              </div>

              <div className="mt-3 border-t border-grey-100 pt-3">
                <GrantRoleForm
                  userId={user.id}
                  organisations={organisations ?? []}
                  roles={(roles ?? []).map((r) => ({
                    id: r.id,
                    name: r.name,
                    organisationId: r.organisation_id,
                    isGlobal: r.organisation_id === null,
                  }))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divisions */}
      <div>
        <h2 className="font-display text-xl">Divisions/Teams</h2>
        <p className="mt-1 text-sm text-grey-600">
          Divisions within each organisation, e.g. United States
          Attorney&rsquo;s Office. Assign people when inviting, converting or
          adding employees.
        </p>
        <div className="mt-4 rounded border border-grey-200 bg-white p-4">
          <CreateDivisionForm organisations={organisations ?? []} />
          <div className="mt-4 flex flex-wrap gap-2">
            {(divisions ?? []).map((d) => (
              <span key={d.id} className="rounded bg-grey-100 px-2 py-1 text-xs">
                {d.name}
                <span className="ml-1 text-grey-500">
                  · {(d.organisations as unknown as { name: string } | null)?.name ?? "?"}
                </span>
              </span>
            ))}
            {(divisions ?? []).length === 0 && (
              <span className="text-xs text-grey-500">No divisions yet.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
