import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-blue-50 text-navy-900",
  under_review: "bg-amber-50 text-amber-800",
  accepted: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-800",
  withdrawn: "bg-grey-100 text-grey-600",
};

const STATUSES = ["submitted", "under_review", "accepted", "rejected", "withdrawn"];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vacancy?: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.APPLICATIONS_ALL_VIEW))) {
    redirect("/portal/admin");
  }

  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status ?? "") ? params.status : undefined;
  const vacancyFilter = params.vacancy;

  const service = createSupabaseServiceClient();

  const [{ data: vacancies }, applicationsResult] = await Promise.all([
    service.from("vacancies").select("id, title").order("title"),
    (() => {
      let q = service
        .from("applications")
        .select(
          "id, app_number, status, submitted_at, vacancies(title), profiles:user_id(display_name)",
        )
        .order("submitted_at", { ascending: false })
        .limit(200);
      if (statusFilter) q = q.eq("status", statusFilter);
      if (vacancyFilter) q = q.eq("vacancy_id", vacancyFilter);
      return q;
    })(),
  ]);

  const applications = applicationsResult.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg">Applications</h3>
        <form method="get" className="flex flex-wrap gap-2">
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded border border-grey-300 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            name="vacancy"
            defaultValue={vacancyFilter ?? ""}
            className="rounded border border-grey-300 px-2 py-1.5 text-sm"
          >
            <option value="">All vacancies</option>
            {(vacancies ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
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
        {applications.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            No applications match.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Applicant</th>
                <th className="px-5 py-3 font-medium">Vacancy</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const vacancyTitle =
                  (app.vacancies as unknown as { title: string } | null)
                    ?.title ?? "—";
                const applicantName =
                  (app.profiles as unknown as { display_name: string } | null)
                    ?.display_name || "Unnamed applicant";
                return (
                  <tr key={app.id} className="border-b border-grey-100 hover:bg-grey-050">
                    <td className="px-5 py-3">
                      <Link
                        href={`/portal/admin/applications/${app.id}`}
                        className="font-mono text-navy-900 hover:underline"
                      >
                        {app.app_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{applicantName}</td>
                    <td className="px-5 py-3">{vacancyTitle}</td>
                    <td className="px-5 py-3">{formatDate(app.submitted_at)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[app.status] ?? ""}`}
                      >
                        {app.status.replace("_", " ")}
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
