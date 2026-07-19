import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import {
  GrantRoleForm,
  RevokeRoleButton,
  SuspendControls,
  EditUserPanel,
  MembershipDivisionSelect,
  DeleteUserButton,
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

  const [
    { data: profiles, error: profilesError },
    { data: memberships, error: membershipsError },
    { data: statuses, error: statusesError },
  ] = await Promise.all([
      userIds.length
        ? service.from("profiles").select("id, display_name, roblox_username").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? service
            .from("memberships")
            .select(
              "id, user_id, organisation_id, office_id, organisations(name), membership_roles(membership_id, role_id, roles(name))",
            )
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? service
            .from("user_security_status")
            .select("user_id, suspended_at, suspension_reason")
            .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const queryErrors = [
    profilesError && `profiles: ${profilesError.message}`,
    membershipsError && `memberships: ${membershipsError.message}`,
    statusesError && `security status: ${statusesError.message}`,
    usersResult.error && `auth users: ${usersResult.error.message}`,
  ].filter(Boolean) as string[];

  const profileById = new Map(
    (profiles ?? []).map(
      (p) => [p.id, { name: p.display_name, roblox: p.roblox_username ?? "" }] as const,
    ),
  );
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
      name: profileById.get(u.id)?.name ?? "Unnamed",
      roblox: profileById.get(u.id)?.roblox ?? "",
      suspended: suspendedById.get(u.id) ?? false,
      memberships: membershipsByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      {queryErrors.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Some data failed to load:
          </p>
          {queryErrors.map((err) => (
            <p key={err} className="mt-1 text-sm text-red-800">
              {err}
            </p>
          ))}
        </div>
      )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <EditUserPanel
                    userId={user.id}
                    displayName={user.name}
                    robloxUsername={user.roblox}
                    email={user.email}
                  />
                  <SuspendControls userId={user.id} isSuspended={user.suspended} />
                  <DeleteUserButton userId={user.id} email={user.email} />
                </div>
              </div>

              {/* Memberships: roles + division per organisation */}
              <div className="mt-3 space-y-2">
                {user.memberships.length === 0 && (
                  <span className="text-xs text-grey-500">No memberships</span>
                )}
                {user.memberships.map((m) => {
                  const orgName =
                    (m.organisations as unknown as { name: string } | null)?.name ?? "?";
                  const roleEntries =
                    (m.membership_roles as unknown as Array<{
                      membership_id: string;
                      role_id: string;
                      roles: { name: string } | null;
                    }>) ?? [];
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-2 rounded bg-grey-050 px-2 py-1.5"
                    >
                      <span className="text-xs font-medium">{orgName}</span>
                      {roleEntries.length === 0 ? (
                        <span className="text-xs text-grey-500">No roles</span>
                      ) : (
                        roleEntries.map((mr) => (
                          <span
                            key={`${mr.membership_id}:${mr.role_id}`}
                            className="flex items-center rounded bg-grey-100 px-2 py-1 text-xs"
                          >
                            {mr.roles?.name ?? "?"}
                            <RevokeRoleButton
                              membershipId={mr.membership_id}
                              roleId={mr.role_id}
                            />
                          </span>
                        ))
                      )}
                      <span className="ml-auto">
                        <MembershipDivisionSelect
                          membershipId={m.id}
                          organisationId={m.organisation_id}
                          currentOfficeId={m.office_id}
                          divisions={(divisions ?? []).map((d) => ({
                            id: d.id,
                            name: d.name,
                            organisationId: d.organisation_id,
                          }))}
                        />
                      </span>
                    </div>
                  );
                })}
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

    </div>
  );
}
