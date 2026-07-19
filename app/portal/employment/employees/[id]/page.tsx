import { createSupabaseServiceClient } from "@/lib/db/server";
import {
  hasPermissionAnywhere,
  getPermittedOrgIds,
  userHasPermission,
} from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { DOCUMENTS_BUCKET, formatSize } from "@/lib/documents/storage";
import { EMPLOYEE_FILES_ROOT } from "@/lib/documents/access";
import type { ChecklistState } from "@/lib/employees/checklist";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Checklist, EmployeeFileUpload, DeleteEmployeeFileButton, EmployeeStatusControls } from "../widgets";

export const metadata = { title: "Employee" };

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canViewAll = await hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_ALL_VIEW);
  const canViewDept = await hasPermissionAnywhere(
    PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
  );
  if (!canViewAll && !canViewDept) redirect("/portal/admin");

  const { id } = await params;
  const service = createSupabaseServiceClient();

  const { data: emp } = await service
    .from("employees")
    .select(
      "id, employee_number, user_id, rank, status, started_at, ended_at, end_reason, checklist, organisation_id, organisations(name, slug), offices(name)",
    )
    .eq("id", id)
    .single();
  if (!emp) notFound();

  // Departmental scoping on direct URLs
  const scope = await getPermittedOrgIds(
    canViewAll ? PERMISSIONS.EMPLOYEES_ALL_VIEW : PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
  );
  if (!scope.all && !scope.orgIds.includes(emp.organisation_id)) {
    redirect("/portal/employment/employees");
  }

  const canEdit = await userHasPermission(
    PERMISSIONS.EMPLOYEES_UPDATE,
    emp.organisation_id,
  );
  const canDeleteFiles = await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_ARCHIVE);

  const org = emp.organisations as unknown as { name: string; slug: string } | null;
  const division = emp.offices as unknown as { name: string } | null;

  // Profile + Discord info
  const { data: profile } = await service
    .from("profiles")
    .select("display_name, roblox_username, discord_username")
    .eq("id", emp.user_id)
    .single();

  // Files
  const filePrefix = org
    ? `${EMPLOYEE_FILES_ROOT}/${org.slug.toLowerCase()}/${emp.employee_number}`
    : null;
  const { data: fileEntries } = filePrefix
    ? await service.storage
        .from(DOCUMENTS_BUCKET)
        .list(filePrefix, { limit: 100, sortBy: { column: "name", order: "asc" } })
    : { data: [] };
  const files = (fileEntries ?? []).filter((f) => f.id);

  // Names for "ticked by" on the checklist
  const checklist = (emp.checklist ?? {}) as ChecklistState;
  const tickerIds = [
    ...new Set(
      Object.values(checklist)
        .map((v) => v.by)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const { data: tickers } = tickerIds.length
    ? await service.from("profiles").select("id, display_name").in("id", tickerIds)
    : { data: [] };
  const nameById = Object.fromEntries(
    (tickers ?? []).map((t) => [t.id, t.display_name] as const),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal/employment/employees"
          className="rounded border border-grey-300 bg-white px-2.5 py-1 text-sm hover:border-navy-900"
        >
          ← Back
        </Link>
        <h2 className="font-display text-xl">
          {profile?.display_name ?? "Employee"}{" "}
          <span className="text-grey-500">· {emp.employee_number}</span>
        </h2>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
            emp.status === "active"
              ? "bg-green-50 text-green-700"
              : emp.status === "dismissed"
                ? "bg-red-50 text-red-800"
                : "bg-grey-100 text-grey-600"
          }`}
        >
          {emp.status}
        </span>
        {canEdit && (
          <span className="ml-auto">
            <EmployeeStatusControls employeeId={emp.id} status={emp.status} />
          </span>
        )}
      </div>

      {emp.status !== "active" && (
        <div className="rounded border border-grey-200 bg-grey-050 px-4 py-3 text-sm text-grey-700">
          {emp.status === "dismissed" ? "Dismissed" : "Resigned"}
          {emp.ended_at ? ` on ${formatDate(emp.ended_at)}` : ""}
          {emp.end_reason ? ` — ${emp.end_reason}` : ""}. Their roles in this
          organisation were removed; the account itself still exists.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded border border-grey-200 bg-white p-6">
          <h2 className="font-medium">Details</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-grey-600">Organisation</dt>
            <dd>{org?.name ?? "—"}</dd>
            <dt className="text-grey-600">Division/Team</dt>
            <dd>{division?.name ?? "—"}</dd>
            <dt className="text-grey-600">Rank</dt>
            <dd>{emp.rank ?? "—"}</dd>
            <dt className="text-grey-600">Started</dt>
            <dd>{formatDate(emp.started_at)}</dd>
            <dt className="text-grey-600">Roblox</dt>
            <dd>{profile?.roblox_username ?? "—"}</dd>
            <dt className="text-grey-600">Discord</dt>
            <dd>{profile?.discord_username ?? "Not linked"}</dd>
          </dl>
        </div>

        {/* Checklist */}
        <div className="rounded border border-grey-200 bg-white p-6">
          <Checklist
            employeeId={emp.id}
            state={checklist}
            canEdit={canEdit}
            nameById={nameById}
          />
        </div>
      </div>

      {/* Files */}
      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Files</h2>
        <p className="mt-1 text-sm text-grey-600">
          Signed NDA, contract and anything else tied to this employee. Stored
          privately; only staff with employee access for {org?.name ?? "this organisation"} can
          see these.
        </p>

        {canEdit && (
          <div className="mt-4">
            <EmployeeFileUpload employeeId={emp.id} />
          </div>
        )}

        <div className="mt-4">
          {files.length === 0 ? (
            <p className="text-sm text-grey-500">No files uploaded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-200 text-left text-grey-600">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 font-medium">Uploaded</th>
                  {canDeleteFiles && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const meta = file.metadata as { size?: number } | null;
                  return (
                    <tr key={file.name} className="border-b border-grey-100">
                      <td className="py-2">
                        <a
                          href={`/portal/documents/download?path=${encodeURIComponent(
                            `${filePrefix}/${file.name}`,
                          )}`}
                          className="text-navy-900 hover:underline"
                        >
                          {file.name}
                        </a>
                      </td>
                      <td className="py-2 text-grey-600">{formatSize(meta?.size ?? null)}</td>
                      <td className="py-2 text-grey-600">{formatDate(file.created_at)}</td>
                      {canDeleteFiles && (
                        <td className="py-2 text-right">
                          <DeleteEmployeeFileButton
                            employeeId={emp.id}
                            fileName={file.name}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
