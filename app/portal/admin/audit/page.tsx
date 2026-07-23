import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    redirect("/portal?denied=the audit log");
  }
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number(params.page) || 1);

  const service = createSupabaseServiceClient();
  let query = service
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, reason, actor_id, organisation_id, created_at, organisations(name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("action", `%${q}%`);
  const { data: rows, count } = await query;

  const actorIds = Array.from(
    new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean)),
  ) as string[];
  const { data: profiles } = actorIds.length
    ? await service.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Audit log</h2>
          <p className="mt-1 text-sm text-grey-600">
            Every significant action on the platform, most recent first
            {typeof count === "number" ? ` (${count} total)` : ""}.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Filter by action, e.g. foi. or user.role"
            className="w-64 rounded border border-grey-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800"
          >
            Filter
          </button>
          {q && (
            <Link href="/portal/admin/audit" className="text-sm text-grey-500 hover:underline">
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="overflow-x-auto rounded border border-grey-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-200 text-left text-xs uppercase tracking-wide text-grey-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-grey-600">
                  No entries{q ? " matching that filter" : ""}.
                </td>
              </tr>
            ) : (
              (rows ?? []).map((row) => (
                <tr key={row.id} className="border-b border-grey-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-grey-600">
                    {formatWhen(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.actor_id ? nameById.get(row.actor_id) || "Unknown" : "System"}
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-grey-100 px-1.5 py-0.5 text-xs">
                      {row.action}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-grey-600">
                    {(row.organisations as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="max-w-md px-4 py-2.5 text-grey-700">
                    {row.reason ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/portal/admin/audit?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="rounded border border-grey-300 px-3 py-1.5 hover:border-navy-900"
            >
              ← Newer
            </Link>
          )}
          <span className="text-grey-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/portal/admin/audit?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="rounded border border-grey-300 px-3 py-1.5 hover:border-navy-900"
            >
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
