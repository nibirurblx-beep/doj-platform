import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere, getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { StatusControls, NoteForm, ScheduleInterviewControl } from "../review-controls";
import { ConvertForm } from "../convert-form";

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
      "id, app_number, status, submitted_at, answers, user_id, vacancies(title, questions, organisation_id), interview_at, interview_note",
    )
    .eq("id", id)
    .single();
  if (!app) notFound();

  // Departmental scoping: block direct-URL access to other departments
  const vacancyOrg = (app.vacancies as unknown as {
    organisation_id?: string;
  } | null)?.organisation_id;
  const allScope = await getPermittedOrgIds(PERMISSIONS.APPLICATIONS_ALL_VIEW);
  const deptScope = await getPermittedOrgIds(
    PERMISSIONS.APPLICATIONS_DEPARTMENT_VIEW,
  );
  const allowedOrgIds = new Set([
    ...(allScope.all ? [] : allScope.orgIds),
    ...(deptScope.all ? [] : deptScope.orgIds),
  ]);
  const orgAllowed =
    allScope.all || deptScope.all || (vacancyOrg ? allowedOrgIds.has(vacancyOrg) : false);
  if (!orgAllowed) {
    redirect("/portal/employment/applications");
  }

  const canCreateEmployee = await hasPermissionAnywhere(
    PERMISSIONS.EMPLOYEES_CREATE,
  );

  // Conversion panel data (only when accepted and permitted)
  let conversion: {
    alreadyEmployee: boolean;
    organisations: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string; organisation_id: string | null }>;
    offices: Array<{ id: string; name: string; organisation_id: string }>;
  } | null = null;

  if (app.status === "accepted" && canCreateEmployee) {
    const [emp, orgs, roles, offices] = await Promise.all([
      service
        .from("employees")
        .select("id")
        .eq("user_id", app.user_id)
        .limit(1),
      service.from("organisations").select("id, name").order("name"),
      service
        .from("roles")
        .select("id, name, organisation_id")
        .not("organisation_id", "is", null)
        .order("name"),
      service.from("offices").select("id, name, organisation_id").order("name"),
    ]);
    conversion = {
      alreadyEmployee: Boolean(emp.data && emp.data.length > 0),
      organisations: orgs.data ?? [],
      roles: roles.data ?? [],
      offices: offices.data ?? [],
    };
  }

  const { data: notes } = await service
    .from("application_notes")
    .select("id, body, created_at, author_id")
    .eq("application_id", id)
    .order("created_at", { ascending: true });

  // Fetch all involved profiles in one query (applicant + note authors)
  const profileIds = [
    ...new Set([app.user_id, ...(notes ?? []).map((n) => n.author_id)]),
  ];
  const { data: profileRows } = await service
    .from("profiles")
    .select("id, display_name, roblox_username")
    .in("id", profileIds);
  const profileById = new Map(
    (profileRows ?? []).map((p) => [p.id, p] as const),
  );

  const vacancy = app.vacancies as unknown as {
    title: string;
    questions: Question[];
    organisation_id: string;
  } | null;
  const applicant = profileById.get(app.user_id) ?? null;
  const answers = (app.answers as Record<string, string>) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/employment/applications"
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
                <div className="space-y-3">
                  <StatusControls applicationId={app.id} status={app.status} />
                  <ScheduleInterviewControl
                    applicationId={app.id}
                    status={app.status}
                  />
                  {app.status === "interview" && app.interview_at && (
                    <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
              </div>
            </section>
          )}

          {/* Conversion */}
          {conversion && (
            <section className="rounded border border-grey-200 bg-white p-5">
              <h4 className="font-display text-lg">Convert to employee</h4>
              {conversion.alreadyEmployee ? (
                <p className="mt-2 text-sm text-grey-600">
                  This person already has an employee record.
                </p>
              ) : (
                <div className="mt-3">
                  <ConvertForm
                    applicationId={app.id}
                    organisations={conversion.organisations}
                    roles={conversion.roles}
                    offices={conversion.offices}
                    defaultOrganisationId={vacancy?.organisation_id ?? ""}
                  />
                </div>
              )}
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
                const author = profileById.get(note.author_id) ?? null;
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
