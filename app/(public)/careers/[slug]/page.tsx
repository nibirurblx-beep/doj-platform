import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ApplicationForm } from "./application-form";

interface Question {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "yes_no" | "select";
  required: boolean;
  options?: string[];
}

async function getVacancy(slug: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("vacancies")
    .select("id, title, summary, description_html, questions, organisations(name)")
    .eq("slug", slug)
    .eq("status", "open")
    .single();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vacancy = await getVacancy(slug);
  if (!vacancy) return { title: "Not found" };
  return { title: vacancy.title, description: vacancy.summary ?? undefined };
}

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vacancy = await getVacancy(slug);
  if (!vacancy) notFound();

  // Signed-in state decides what the Apply section shows
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let alreadyApplied = false;
  if (user) {
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("vacancy_id", vacancy.id)
      .eq("user_id", user.id)
      .limit(1);
    alreadyApplied = Boolean(existing && existing.length > 0);
  }

  const orgName =
    (vacancy.organisations as unknown as { name: string } | null)?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/careers" className="text-sm text-navy-900 underline">
        ← All vacancies
      </Link>

      <p className="mt-6 text-xs uppercase tracking-wide text-grey-500">
        {orgName}
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight">
        {vacancy.title}
      </h1>
      {vacancy.summary && (
        <p className="mt-3 text-lg text-grey-600">{vacancy.summary}</p>
      )}

      <div
        className="prose mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: vacancy.description_html }}
      />

      <div className="mt-12 border-t border-grey-200 pt-8">
        <h2 className="font-display text-xl">Apply for this position</h2>

        {!user ? (
          <div className="mt-4 rounded border border-grey-200 bg-grey-050 p-5">
            <p className="text-sm text-grey-700">
              You need an applicant account to apply.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href={`/auth/register?next=/careers/${slug}`}
                className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
              >
                Create an account
              </Link>
              <Link
                href={`/auth/login?next=/careers/${slug}`}
                className="rounded border border-grey-300 bg-white px-4 py-2 text-sm hover:border-navy-900"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : alreadyApplied ? (
          <div className="mt-4 rounded border border-grey-200 bg-grey-050 p-5">
            <p className="text-sm text-grey-700">
              You have already applied for this vacancy. Track it from your{" "}
              <Link href="/applicant" className="text-navy-900 underline">
                applicant dashboard
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <ApplicationForm
              vacancyId={vacancy.id}
              questions={(vacancy.questions as Question[]) ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}
