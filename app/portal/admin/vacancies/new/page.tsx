import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import { VacancyForm } from "../vacancy-form";

export default async function NewVacancyPage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.VACANCIES_MANAGE))) {
    redirect("/portal/admin");
  }
  const canPublish = await hasPermissionAnywhere(PERMISSIONS.VACANCIES_PUBLISH);

  const service = createSupabaseServiceClient();
  const { data: organisations } = await service
    .from("organisations")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg">New vacancy</h3>
      <VacancyForm
        vacancy={{
          title: "",
          slug: "",
          summary: "",
          organisationId: organisations?.[0]?.id ?? "",
          descriptionHtml: "<p></p>",
          questions: [],
          status: "draft",
        }}
        organisations={organisations ?? []}
        canPublish={canPublish}
      />
    </div>
  );
}
