import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import { VacancyForm } from "../vacancy-form";
import type { VacancyQuestion } from "../actions";

export default async function EditVacancyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasPermissionAnywhere(PERMISSIONS.VACANCIES_MANAGE))) {
    redirect("/portal/admin");
  }
  const canPublish = await hasPermissionAnywhere(PERMISSIONS.VACANCIES_PUBLISH);

  const { id } = await params;
  const service = createSupabaseServiceClient();

  const [{ data: vacancy }, { data: organisations }] = await Promise.all([
    service
      .from("vacancies")
      .select("id, slug, title, summary, organisation_id, description_html, questions, status")
      .eq("id", id)
      .single(),
    service.from("organisations").select("id, name").order("name"),
  ]);

  if (!vacancy) notFound();

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">Edit vacancy</h3>
      <VacancyForm
        vacancy={{
          id: vacancy.id,
          title: vacancy.title,
          slug: vacancy.slug,
          summary: vacancy.summary ?? "",
          organisationId: vacancy.organisation_id,
          descriptionHtml: vacancy.description_html,
          questions: (vacancy.questions as VacancyQuestion[]) ?? [],
          status: vacancy.status,
        }}
        organisations={organisations ?? []}
        canPublish={canPublish}
      />
    </div>
  );
}
