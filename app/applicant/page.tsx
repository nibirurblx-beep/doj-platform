import { createSupabaseServerClient } from "@/lib/db/server";
import { getCurrentUser } from "@/lib/auth/session";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Submitted", tone: "bg-blue-50 text-navy-900" },
  interview: { label: "Interview scheduled", tone: "bg-amber-50 text-amber-900" },
  under_review: { label: "Under review", tone: "bg-amber-50 text-amber-800" },
  accepted: { label: "Accepted", tone: "bg-green-50 text-green-700" },
  rejected: { label: "Unsuccessful", tone: "bg-red-50 text-red-800" },
  withdrawn: { label: "Withdrawn", tone: "bg-grey-100 text-grey-600" },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ApplicantPage() {
  const user = await getCurrentUser();

  // RLS: this select only ever returns the signed-in user's own applications
  const supabase = await createSupabaseServerClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("id, app_number, status, submitted_at, interview_at, interview_note, vacancies(title, slug)")
    .order("submitted_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Applicant dashboard</h1>
        <p className="mt-2 text-grey-600">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}. Your
          applications and their status appear below.
        </p>
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Your applications</h2>
          <Link href="/careers" className="text-sm text-navy-900 underline">
            Browse open positions
          </Link>
        </div>

        {!applications || applications.length === 0 ? (
          <div className="mt-4 rounded border border-grey-200 bg-white p-6">
            <p className="text-sm text-grey-600">
              You have not applied for anything yet.{" "}
              <Link href="/careers" className="text-navy-900 underline">
                See open positions
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {applications.map((app) => {
              const vacancy =
                (app.vacancies as unknown as {
                  title: string;
                  slug: string;
                } | null) ?? null;
              const status =
                STATUS_LABELS[app.status] ?? STATUS_LABELS.submitted!;
              return (
                <div
                  key={app.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-grey-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium">
                      {vacancy?.title ?? "Vacancy"}
                    </p>
                    <p className="mt-0.5 text-xs text-grey-500">
                      <span className="font-mono">{app.app_number}</span>
                      {" · "}
                      Submitted {formatDate(app.submitted_at)}
                    </p>
                    {app.status === "interview" && app.interview_at && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        Interview:{" "}
                        {new Date(app.interview_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {app.interview_note ? ` — ${app.interview_note}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-medium ${status.tone}`}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
