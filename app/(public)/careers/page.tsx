import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Careers" };
export const revalidate = 300;

export default async function CareersPage() {
  const service = createSupabaseServiceClient();
  const { data: vacancies } = await service
    .from("vacancies")
    .select("slug, title, summary, organisations(name)")
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl">Careers</h1>
      <p className="mt-2 max-w-measure text-grey-600">
        Open positions across the Department of Justice and partner agencies.
        Applications are reviewed by recruitment staff and you can track
        progress from your applicant account.
      </p>

      {!vacancies || vacancies.length === 0 ? (
        <div className="mt-10 rounded border border-grey-200 bg-grey-050 p-6">
          <p className="text-grey-600">
            There are no open positions right now. Check back soon — new
            vacancies are announced on the{" "}
            <Link href="/news" className="text-navy-900 underline">
              news page
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {vacancies.map((vacancy) => {
            const orgName =
              (vacancy.organisations as unknown as { name: string } | null)
                ?.name ?? "";
            return (
              <Link
                key={vacancy.slug}
                href={`/careers/${vacancy.slug}`}
                className="group block rounded border border-grey-200 bg-white p-5 transition hover:border-navy-900"
              >
                <p className="text-xs uppercase tracking-wide text-grey-500">
                  {orgName}
                </p>
                <h2 className="mt-1 font-display text-xl group-hover:underline">
                  {vacancy.title}
                </h2>
                {vacancy.summary && (
                  <p className="mt-2 text-sm text-grey-600">{vacancy.summary}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
