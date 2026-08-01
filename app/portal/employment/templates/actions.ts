"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PlacedField } from "@/lib/signatures/fields";

const TEMPLATE_PREFIX = "templates";
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FIELDS = 40;

async function requireTemplateManager(orgId?: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  // Managing templates uses the same right as managing employees
  if (orgId) {
    if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, orgId))) {
      return { error: "You cannot manage templates for that organisation" as const };
    }
  }
  return { userId: user.id };
}

/** Create a template by uploading a master PDF. Fields are added after. */
export async function createTemplateAction(formData: FormData) {
  const organisationId = formData.get("organisationId");
  const name = formData.get("name");
  const description = formData.get("description");
  const file = formData.get("file");

  if (typeof organisationId !== "string" || !organisationId) {
    return { error: "Choose an organisation" };
  }
  const actor = await requireTemplateManager(organisationId);
  if ("error" in actor) return { error: actor.error };

  if (typeof name !== "string" || name.trim().length < 2) {
    return { error: "Give the template a name" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload a PDF" };
  }
  if (file.type !== "application/pdf") return { error: "The template must be a PDF" };
  if (file.size > MAX_BYTES) return { error: "PDF too large (15 MB max)" };

  const service = createSupabaseServiceClient();
  const { data: created, error } = await service
    .from("signature_templates")
    .insert({
      organisation_id: organisationId,
      name: name.trim().slice(0, 120),
      description:
        typeof description === "string" ? description.trim().slice(0, 500) || null : null,
      document_path: "", // set after we know the id
      fields: [],
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message || "Could not create template" };

  const path = `${TEMPLATE_PREFIX}/${created.id}.pdf`;
  const { error: uploadError } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    await service.from("signature_templates").delete().eq("id", created.id);
    return { error: uploadError.message };
  }

  await service
    .from("signature_templates")
    .update({ document_path: path })
    .eq("id", created.id);

  await logAudit(service, {
    action: "template.created",
    entityType: "signature_templates",
    entityId: created.id,
    orgId: organisationId,
    reason: name.trim(),
    actor: actor.userId,
  });

  redirect(`/portal/employment/templates/${created.id}`);
}

/** Save the placed fields onto a template. */
export async function saveTemplateFieldsAction(
  templateId: string,
  fields: PlacedField[],
) {
  const service = createSupabaseServiceClient();
  const { data: template } = await service
    .from("signature_templates")
    .select("id, organisation_id")
    .eq("id", templateId)
    .single();
  if (!template) return { error: "Template not found" };

  const actor = await requireTemplateManager(template.organisation_id);
  if ("error" in actor) return { error: actor.error };

  if (!Array.isArray(fields) || fields.length > MAX_FIELDS) {
    return { error: "Too many fields" };
  }

  const { error } = await service
    .from("signature_templates")
    .update({ fields })
    .eq("id", templateId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "template.fields_saved",
    entityType: "signature_templates",
    entityId: templateId,
    orgId: template.organisation_id,
    reason: `${fields.length} fields`,
    actor: actor.userId,
  });
  revalidatePath(`/portal/employment/templates/${templateId}`);
  return { success: true, message: "Template saved" };
}

export async function deleteTemplateAction(formData: FormData) {
  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: template } = await service
    .from("signature_templates")
    .select("id, organisation_id, document_path, name")
    .eq("id", templateId)
    .single();
  if (!template) return { error: "Template not found" };

  const actor = await requireTemplateManager(template.organisation_id);
  if ("error" in actor) return { error: actor.error };

  if (template.document_path) {
    await service.storage.from(DOCUMENTS_BUCKET).remove([template.document_path]);
  }
  const { error } = await service
    .from("signature_templates")
    .delete()
    .eq("id", templateId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "template.deleted",
    entityType: "signature_templates",
    entityId: templateId,
    orgId: template.organisation_id,
    reason: template.name,
    actor: actor.userId,
  });
  revalidatePath("/portal/employment/templates");
  return { success: true, message: "Template deleted" };
}
