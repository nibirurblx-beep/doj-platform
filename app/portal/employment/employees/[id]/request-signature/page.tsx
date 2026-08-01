import { createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import { RequestBuilder } from "@/components/signatures/request-builder";
import { createPlacedSignatureRequestAction, useTemplateAction } from "./actions";
import type { PlacedField } from "@/lib/signatures/fields";

export const metadata = { title: "Prepare document" };

export default async function RequestSignaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; template?: string }>;
}) {
  const { id } = await params;
  const { file: fileParam, template: templateId } = await searchParams;

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, employee_number, user_id")
    .eq("id", id)
    .single();
  if (!employee) notFound();

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    redirect("/portal?denied=signature requests");
  }

  // Resolve the working document: either an existing file, or a freshly
  // cloned copy of a template (whose fields we pre-load).
  let fileName: string;
  let initialFields: PlacedField[] = [];
  let fromTemplate = false;

  if (templateId) {
    const result = await useTemplateAction(id, templateId);
    if ("error" in result) {
      return (
        <div className="mx-auto max-w-xl rounded border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-800">{result.error}</p>
        </div>
      );
    }
    fileName = result.fileName;
    initialFields = (Array.isArray(result.fields) ? result.fields : []) as PlacedField[];
    fromTemplate = true;
  } else {
    if (!fileParam || fileParam.includes("/") || !fileParam.toLowerCase().endsWith(".pdf")) {
      notFound();
    }
    fileName = fileParam;
  }

  async function create(fields: PlacedField[], checklistKey: string) {
    "use server";
    return createPlacedSignatureRequestAction(id, fileName, fields, checklistKey);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Prepare document: {fileName}</h2>
        <p className="mt-1 text-sm text-grey-600">
          {fromTemplate
            ? "Started from a template. The fields below came with it - adjust if needed, fill your details, then send."
            : "For " +
              employee.employee_number +
              ". Place signature, initials, text and date fields. Choose who signs or fills each one, and whether you fill it before sending or the signer fills it."}{" "}
          The employee completes their fields first, then you countersign. A
          certificate recording all signers is added when complete.
        </p>
      </div>
      <RequestBuilder
        documentUrl={`/portal/employment/employees/${id}/file?name=${encodeURIComponent(fileName)}`}
        action={create}
        initialFields={initialFields}
      />
    </div>
  );
}
