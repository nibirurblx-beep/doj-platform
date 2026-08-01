import { createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TemplateFieldEditor } from "./editor";
import { saveTemplateFieldsAction } from "../actions";
import type { PlacedField } from "@/lib/signatures/fields";

export const metadata = { title: "Template fields" };

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = createSupabaseServiceClient();
  const { data: template } = await service
    .from("signature_templates")
    .select("id, name, fields, organisation_id")
    .eq("id", id)
    .single();
  if (!template) notFound();

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, template.organisation_id))) {
    redirect("/portal?denied=document templates");
  }

  async function save(fields: PlacedField[]) {
    "use server";
    return saveTemplateFieldsAction(id, fields);
  }

  const existing = (Array.isArray(template.fields) ? template.fields : []) as PlacedField[];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/portal/employment/templates"
          className="text-sm text-navy-900 underline"
        >
          ← All templates
        </Link>
        <h2 className="mt-2 font-display text-xl">Fields: {template.name}</h2>
        <p className="mt-1 text-sm text-grey-600">
          Place the fields that appear on every request from this template.
          Mark text and date fields as filled by you (before sending) or by the
          signer. When you start a request from this template you will confirm
          your fields, then send.
        </p>
      </div>
      <TemplateFieldEditor
        documentUrl={`/portal/employment/templates/${id}/file`}
        existing={existing}
        action={save}
      />
    </div>
  );
}
