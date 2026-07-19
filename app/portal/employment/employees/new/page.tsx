import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere, getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AddEmployeeForm } from "../widgets";

export const metadata = { title: "Add employee" };

export default async function AddEmployeePage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_CREATE))) {
    redirect("/portal/employment/employees");
  }

  const scope = await getPermittedOrgIds(PERMISSIONS.EMPLOYEES_CREATE);
  const service = createSupabaseServiceClient();

  let orgQuery = service.from("organisations").select("id, name, slug").order("name");
  if (!scope.all) orgQuery = orgQuery.in("id", scope.orgIds);
  const { data: organisations } = await orgQuery;
  const orgIds = (organisations ?? []).map((o) => o.id);

  const [{ data: roles }, { data: divisions }, usersResult] = await Promise.all([
    orgIds.length
      ? service
          .from("roles")
          .select("id, name, organisation_id")
          .in("organisation_id", orgIds)
          .order("name")
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? service
          .from("offices")
          .select("id, name, organisation_id")
          .in("organisation_id", orgIds)
          .order("name")
      : Promise.resolve({ data: [] }),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ]);

  const userIds = (usersResult.data?.users ?? []).map((u) => u.id);
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name] as const));

  const users = (usersResult.data?.users ?? [])
    .map((u) => ({
      id: u.id,
      label: `${nameById.get(u.id) || "Unnamed"} — ${u.email ?? "no email"}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/portal/employment/employees"
          className="rounded border border-grey-300 bg-white px-2.5 py-1 text-sm hover:border-navy-900"
        >
          ← Back
        </Link>
        <h2 className="font-display text-xl">Add employee</h2>
      </div>
      <p className="text-sm text-grey-600">
        Creates an employee record directly, without an application: the user
        gets a membership, the chosen role, and an employee number. Use this
        for people brought in outside the normal careers process.
      </p>
      <div className="rounded border border-grey-200 bg-white p-6">
        <AddEmployeeForm
          users={users}
          organisations={(organisations ?? []).map((o) => ({ id: o.id, name: o.name }))}
          roles={(roles ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            organisationId: r.organisation_id,
          }))}
          divisions={(divisions ?? []).map((d) => ({
            id: d.id,
            name: d.name,
            organisationId: d.organisation_id,
          }))}
        />
      </div>
    </div>
  );
}
