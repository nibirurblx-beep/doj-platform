import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-grey-100 text-grey-700",
  open: "bg-green-50 text-green-700",
  closed: "bg-red-50 text-red-800",
};

export default async function VacanciesAdminPage() {
  const service = createSupabaseServiceClient();
  const { data: vacancies } = await service
    .from("vacancies")
    .select("id, slug, title, status, updated_at, organisations(name), applications(count)")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Vacancies</h3>
        <Link
          href="/portal/employment/vacancies/new"
          className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800"
        >
          New vacancy
        </Link>
      </div>

      <div className="rounded border border-grey-200 bg-white">
        {!vacancies || vacancies.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            No vacancies yet. Create one above; it stays hidden from the public
            until you open it for applications.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Organisation</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Applications</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((vacancy) => {
                const orgName =
                  (vacancy.organisations as unknown as { name: string } | null)
                    ?.name ?? "—";
                const appCount =
                  (vacancy.applications as unknown as Array<{ count: number }>)?.[0]
                    ?.count ?? 0;
                return (
                  <tr key={vacancy.id} className="border-b border-grey-100 hover:bg-grey-050">
                    <td className="px-5 py-3">
                      <Link
                        href={`/portal/employment/vacancies/${vacancy.id}`}
                        className="font-medium text-navy-900 hover:underline"
                      >
                        {vacancy.title}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-grey-500">
                        /{vacancy.slug}
                      </span>
                    </td>
                    <td className="px-5 py-3">{orgName}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[vacancy.status] ?? ""}`}
                      >
                        {vacancy.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">{appCount}</td>
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
