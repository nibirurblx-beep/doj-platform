import { createSupabaseServiceClient } from "@/lib/db/server";
import { getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreateTemplateForm, DeleteTemplateButton } from "./widgets";

export const metadata = { title: "Document templates" };

export default async function TemplatesPage() {
  const scope = await getPermittedOrgIds(PERMISSIONS.EMPLOYEES_UPDATE);
  if (!scope.all && scope.orgIds.length === 0) {
    redirect("/portal?denied=document templates");
  }

  const service = createSupabaseServiceClient();
  let orgQuery = service.from("organisations").select("id, name").order("name");
  if (!scope.all) orgQuery = orgQuery.in("id", scope.orgIds);
  const { data: organisations } = await orgQuery;

  let tplQuery = service
    .from("signature_templates")
    .select("id, name, description, fields, organisation_id, organisations(name)")
    .order("created_at", { ascending: false });
  if (!scope.all) tplQuery = tplQuery.in("organisation_id", scope.orgIds);
  const { data: templates } = await tplQuery;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Document templates</h1>
        <p className="mt-1 text-sm text-grey-600">
          Upload a master PDF once (NDA, contract, and so on), place the
          reusable fields on it, then start signature requests from it without
          editing the PDF each time.
        </p>
      </div>

      <div className="rounded border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-medium">New template</h2>
        <div className="mt-3">
          <CreateTemplateForm
            organisations={(organisations ?? []).map((o) => ({
              id: o.id,
              name: o.name,
            }))}
          />
        </div>
      </div>

      <div className="space-y-3">
        {(templates ?? []).length === 0 ? (
          <p className="rounded border border-grey-200 bg-white p-5 text-sm text-grey-600">
            No templates yet.
          </p>
        ) : (
          (templates ?? []).map((tpl) => {
            const fieldCount = Array.isArray(tpl.fields) ? tpl.fields.length : 0;
            return (
              <div
                key={tpl.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-grey-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-grey-500">
                    {(tpl.organisations as unknown as { name: string } | null)?.name}{" "}
                    · {fieldCount} field{fieldCount === 1 ? "" : "s"}
                    {fieldCount === 0 && " · needs setup"}
                  </p>
                  {tpl.description && (
                    <p className="mt-1 text-sm text-grey-700">{tpl.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/portal/employment/templates/${tpl.id}`}
                    className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-navy-900"
                  >
                    {fieldCount === 0 ? "Set up fields" : "Edit fields"}
                  </Link>
                  <DeleteTemplateButton templateId={tpl.id} name={tpl.name} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
