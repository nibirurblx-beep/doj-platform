"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { CHECKLIST_ITEMS } from "@/lib/employees/checklist";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import type { PlacedField } from "@/lib/signatures/fields";

const MAX_FIELDS = 40;

/** Validate a placed field from the client. */
function validField(f: PlacedField): boolean {
  if (typeof f.page !== "number" || f.page < 0 || f.page > 500) return false;
  if ([f.x, f.y, f.w, f.h].some((n) => typeof n !== "number" || n < 0 || n > 1))
    return false;
  if (!["signature", "initials", "text", "date"].includes(f.kind)) return false;
  if (f.who !== "employee" && f.who !== "employer") return false;
  if (f.kind === "text" || f.kind === "date") {
    if (f.fill !== "sender" && f.fill !== "signer") return false;
  }
  return true;
}

export async function createPlacedSignatureRequestAction(
  employeeId: string,
  fileName: string,
  fields: PlacedField[],
  checklistKey: string,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (!Array.isArray(fields) || fields.length === 0 || fields.length > MAX_FIELDS) {
    return { error: "Place between 1 and 40 fields" };
  }
  for (const f of fields) {
    if (!validField(f)) return { error: "Invalid field placement" };
  }
  if (fileName.includes("/") || !fileName.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files can be sent for signature" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, user_id, organisation_id, employee_number, organisations(slug)")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot manage employees in that organisation" };
  }

  const slug = (employee.organisations as unknown as { slug: string } | null)?.slug;
  const documentPath = `employees/${slug}/${employee.employee_number}/${fileName}`;

  const key = CHECKLIST_ITEMS.some((i) => i.key === checklistKey)
    ? checklistKey
    : null;

  // Split sender-filled values out into field_values; keep them off the
  // pending work. Signer-filled values are captured later, at signing.
  const fieldValues: Record<string, string> = {};
  for (const f of fields) {
    if ((f.kind === "text" || f.kind === "date") && f.fill === "sender" && f.value) {
      fieldValues[f.id] = String(f.value).slice(0, 500);
    }
  }

  const hasEmployeeWork = fields.some(
    (f) =>
      (f.kind === "signature" || f.kind === "initials" || f.fill === "signer") &&
      f.who === "employee",
  );

  const { data: created, error } = await service
    .from("signature_requests")
    .insert({
      employee_id: employee.id,
      user_id: employee.user_id,
      organisation_id: employee.organisation_id,
      document_path: documentPath,
      title: fileName,
      checklist_key: key,
      boxes: fields,
      field_values: fieldValues,
      status: hasEmployeeWork ? "pending" : "pending_employer",
      requested_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message || "Could not create request" };

  await logAudit(service, {
    action: "signature.requested",
    entityType: "signature_requests",
    entityId: created.id,
    orgId: employee.organisation_id,
    reason: `${fileName} (${fields.length} fields)`,
    actor: user.id,
  });

  redirect(`/portal/employment/employees/${employeeId}`);
}

/** Instantiate a request from a template: clone the master PDF into the
 *  employee's files and return the template fields so the requester can
 *  confirm sender values and send. */
export async function useTemplateAction(employeeId: string, templateId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, employee_number, organisations(slug)")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" as const };
  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot manage employees in that organisation" as const };
  }

  const { data: template } = await service
    .from("signature_templates")
    .select("id, name, document_path, fields, organisation_id")
    .eq("id", templateId)
    .single();
  if (!template || template.organisation_id !== employee.organisation_id) {
    return { error: "Template not found" as const };
  }

  const { DOCUMENTS_BUCKET } = await import("@/lib/documents/storage");
  const { data: blob } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(template.document_path);
  if (!blob) return { error: "Template file could not be loaded" as const };

  // Copy into the employee's files under a friendly name
  const slug = (employee.organisations as unknown as { slug: string } | null)?.slug;
  const safeName = template.name.replace(/[^a-z0-9 \-_]/gi, "").trim() || "Document";
  const fileName = `${safeName}.pdf`;
  const destPath = `employees/${slug}/${employee.employee_number}/${fileName}`;
  const { error: upErr } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(destPath, await blob.arrayBuffer(), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) return { error: upErr.message };

  return { success: true as const, fileName, fields: template.fields };
}