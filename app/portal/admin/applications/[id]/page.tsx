import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { StatusControls, NoteForm } from "../review-controls";

interface Question {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-blue-50 text-navy-900",
  under_review: "bg-amber-50 text-amber-800",
  accepted: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-800",
  withdrawn: "bg-grey-100 text-grey-600",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ApplicationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.APPLICATIONS_ALL_VIEW))) {
    redirect("/portal/admin");
  }
  const [canChangeStatus, canNote] = await Promise.all([
    hasPermissionAnywhere(PERMISSIONS.APPLICATIONS_STATUS_CHANGE),
    hasPermissionAnywhere(PERMISSIONS.APPLICATIONS_NOTES_INTERNAL),
  ]);

  const { id } = await params;
  const service = createSupabaseServiceClient();

  const { data: app } = await service
    .from("applications")
    .select(
      "id, app_number, status, submitted_at, answers, vacancies(title, questions), profiles:user_id(display_name, roblox_username)",
    )
    .eq("id", id)
    .single();
  if (!app) notFound();

  const { data: notes } = await service
    .from("application_notes")
    .select("id, body, created_at, profiles:author_id(display_name)")
    .eq("application_id", id)
    .order("created_at", { ascending: true });

  const vacancy = app.vacancies as unknown as {
    title: string;
    questions: Question[];
  } | null;
  const applicant = app.profiles as unknown as {
    display_name: string;
    roblox_username: string | null;
  } | null;
  const answers = (app.answers as Record<string, string>) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/admin/applications"
          className="text-sm text-navy-900 underline"
        >
          ← All applications
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl">
            <span className="font-mono">{app.app_number}</span>
          </h3>
          <span
            className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${STATUS_TONE[app.status] ?? ""}`}
          >
            {app.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-grey-600">
          {vacancy?.title ?? "Vacancy"} · Submitted{" "}
          {formatDateTime(app.submitted_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Applicant */}
          <section className="rounded border border-grey-200 bg-white p-5">
            <h4 className="font-display text-lg">Applicant</h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-grey-500">Display name</dt>
                <dd className="mt-0.5 font-medium">
                  {applicant?.display_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-grey-500">Roblox username</dt>
                <dd className="mt-0.5 font-medium">
                  {applicant?.roblox_username || "—"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Answers */}
          <section className="rounded border border-grey-200 bg-white p-5">
            <h4 className="font-display text-lg">Answers</h4>
            {!vacancy?.questions || vacancy.questions.length === 0 ? (
              <p className="mt-3 text-sm text-grey-600">
                This vacancy had no questions.
              </p>
            ) : (
              <dl className="mt-3 space-y-4">
                {vacancy.questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-sm font-medium">{q.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded bg-grey-050 px-3 py-2 text-sm text-grey-800">
                      {answers[q.id] || (
                        <span className="text-grey-400">No answer</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Actions */}
          {canChangeStatus && (
            <section className="rounded border border-grey-200 bg-white p-5">
              <h4 className="font-display text-lg">Decision</h4>
              <div className="mt-3">
                <StatusControls applicationId={app.id} status={app.status} />
              </div>
            </section>
          )}

          {/* Internal notes */}
          <section className="rounded border border-grey-200 bg-white p-5">
            <h4 className="font-display text-lg">Internal notes</h4>
            <p className="mt-1 text-xs text-grey-500">
              Never visible to the applicant.
            </p>
            <div className="mt-3 space-y-3">
              {(notes ?? []).map((note) => {
                const author = note.profiles as unknown as {
                  display_name: string;
                } | null;
                return (
                  <div
                    key={note.id}
                    className="rounded bg-grey-050 px-3 py-2 text-sm"
                  >
                    <p className="whitespace-pre-wrap text-grey-800">
                      {note.body}
                    </p>
                    <p className="mt-1 text-xs text-grey-500">
                      {author?.display_name || "Staff"} ·{" "}
                      {formatDateTime(note.created_at)}
                    </p>
                  </div>
                );
              })}
              {(!notes || notes.length === 0) && (
                <p className="text-sm text-grey-500">No notes yet.</p>
              )}
            </div>
            {canNote && (
              <div className="mt-4">
                <NoteForm applicationId={app.id} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
