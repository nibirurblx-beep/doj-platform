import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere, getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function EmployeesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const canViewAll = await hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_ALL_VIEW);
  const canViewDept = await hasPermissionAnywhere(
    PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
  );
  if (!canViewAll && !canViewDept) {
    redirect("/portal/admin");
  }

  // Departmental scoping: leadership only sees organisations where they
  // hold the view permission; "all" scope (Platform Admin) sees everything.
  const scope = await getPermittedOrgIds(
    canViewAll
      ? PERMISSIONS.EMPLOYEES_ALL_VIEW
      : PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
  );

  const params = await searchParams;
  const service = createSupabaseServiceClient();

  const [{ data: organisations }, employeesResult] = await Promise.all([
    (() => {
      let q = service.from("organisations").select("id, name").order("name");
      if (!scope.all) q = q.in("id", scope.orgIds);
      return q;
    })(),
    (() => {
      let q = service
        .from("employees")
        .select(
          "id, employee_number, user_id, rank, title, status, started_at, organisation_id, organisations(name)",
        )
        .order("started_at", { ascending: false })
        .limit(200);
      if (!scope.all) q = q.in("organisation_id", scope.orgIds);
      if (params.org && (scope.all || scope.orgIds.includes(params.org)))
        q = q.eq("organisation_id", params.org);
      return q;
    })(),
  ]);

  const employees = employeesResult.data ?? [];

  const userIds = [...new Set(employees.map((e) => e.user_id))];
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name] as const),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg">Employees</h3>
        <form method="get" className="flex gap-2">
          <select
            name="org"
            defaultValue={params.org ?? ""}
            className="rounded border border-grey-300 px-2 py-1.5 text-sm"
          >
            <option value="">All organisations</option>
            {(organisations ?? []).map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="rounded border border-grey-200 bg-white">
        {employees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            No employees yet. Accepted applicants can be converted from their
            application page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Organisation</th>
                <th className="px-5 py-3 font-medium">Rank</th>
                <th className="px-5 py-3 font-medium">Started</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const orgName =
                  (emp.organisations as unknown as { name: string } | null)
                    ?.name ?? "—";
                return (
                  <tr key={emp.id} className="border-b border-grey-100 hover:bg-grey-050">
                    <td className="px-5 py-3 font-mono">
                      <Link
                        href={`/portal/admin/employees/${emp.id}`}
                        className="text-navy-900 hover:underline"
                      >
                        {emp.employee_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {nameById.get(emp.user_id) || "—"}
                    </td>
                    <td className="px-5 py-3">{orgName}</td>
                    <td className="px-5 py-3">{emp.rank || "—"}</td>
                    <td className="px-5 py-3">{formatDate(emp.started_at)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${
                          emp.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-grey-100 text-grey-600"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
