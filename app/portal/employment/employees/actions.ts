"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission, hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { CHECKLIST_ITEMS, type ChecklistState } from "@/lib/employees/checklist";
import { DOCUMENTS_BUCKET, isSafeFileName } from "@/lib/documents/storage";
import { EMPLOYEE_FILES_ROOT } from "@/lib/documents/access";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getActor() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ----------------------------------------------------------------------------
// Direct employee creation (no application needed)
// ----------------------------------------------------------------------------
const addEmployeeSchema = z.object({
  userId: z.string().uuid("Choose a user"),
  organisationId: z.string().uuid("Choose an organisation"),
  roleId: z.string().uuid("Choose a role"),
  officeId: z.string().uuid().optional().or(z.literal("")),
  rank: z.string().max(100).optional().or(z.literal("")),
});

export async function addEmployeeAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const parsed = addEmployeeSchema.safeParse({
    userId: formData.get("userId"),
    organisationId: formData.get("organisationId"),
    roleId: formData.get("roleId"),
    officeId: formData.get("officeId") ?? "",
    rank: formData.get("rank") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_CREATE, input.organisationId))) {
    return { error: "You cannot create employees in that organisation" };
  }

  const service = createSupabaseServiceClient();

  // Anti-escalation: only org-scoped roles of the SAME organisation
  const { data: role } = await service
    .from("roles")
    .select("id, organisation_id")
    .eq("id", input.roleId)
    .single();
  if (!role || role.organisation_id !== input.organisationId) {
    return { error: "Choose a role belonging to that organisation" };
  }

  // Division must belong to the organisation
  if (input.officeId) {
    const { data: office } = await service
      .from("offices")
      .select("id, organisation_id")
      .eq("id", input.officeId)
      .single();
    if (!office || office.organisation_id !== input.organisationId) {
      return { error: "Choose a division belonging to that organisation" };
    }
  }

  // No duplicate employee records per org
  const { data: existing } = await service
    .from("employees")
    .select("id")
    .eq("user_id", input.userId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();
  if (existing) return { error: "That user is already an employee of that organisation" };

  // Membership (create or reuse)
  const { data: membership } = await service
    .from("memberships")
    .select("id")
    .eq("user_id", input.userId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();

  let membershipId = membership?.id;
  if (!membershipId) {
    const { data: newMembership, error: mErr } = await service
      .from("memberships")
      .insert({
        user_id: input.userId,
        organisation_id: input.organisationId,
        office_id: input.officeId || null,
      })
      .select("id")
      .single();
    if (mErr || !newMembership) return { error: mErr?.message || "Membership failed" };
    membershipId = newMembership.id;
  }

  const { error: roleErr } = await service
    .from("membership_roles")
    .insert({ membership_id: membershipId, role_id: input.roleId });
  if (roleErr && !roleErr.message.includes("duplicate")) {
    return { error: roleErr.message };
  }

  // Employee number needs the org slug
  const { data: org } = await service
    .from("organisations")
    .select("slug")
    .eq("id", input.organisationId)
    .single();
  if (!org) return { error: "Organisation not found" };

  const { data: numberData, error: numberError } = await service.rpc(
    "next_employee_number",
    { p_org_slug: org.slug },
  );
  if (numberError || !numberData) {
    return { error: numberError?.message || "Could not allocate employee number" };
  }

  const { data: employee, error: empErr } = await service
    .from("employees")
    .insert({
      user_id: input.userId,
      organisation_id: input.organisationId,
      office_id: input.officeId || null,
      employee_number: numberData,
      rank: input.rank || null,
      status: "active",
    })
    .select("id, employee_number")
    .single();
  if (empErr || !employee) return { error: empErr?.message || "Employee creation failed" };

  await logAudit(service, {
    action: "employee.created",
    entityType: "employees",
    entityId: employee.id,
    orgId: input.organisationId,
    reason: "direct",
    actor: user.id,
  });

  revalidatePath("/portal/employment/employees");
  return { success: true, message: `Created ${employee.employee_number}` };
}

// ----------------------------------------------------------------------------
// Pre-employment checklist
// ----------------------------------------------------------------------------
export async function toggleChecklistAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const employeeId = formData.get("employeeId");
  const itemKey = formData.get("itemKey");
  if (typeof employeeId !== "string" || typeof itemKey !== "string") {
    return { error: "Invalid input" };
  }
  if (!CHECKLIST_ITEMS.some((i) => i.key === itemKey)) {
    return { error: "Unknown checklist item" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, checklist")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot update employees in that organisation" };
  }

  const checklist = (employee.checklist ?? {}) as ChecklistState;
  const wasDone = checklist[itemKey]?.done === true;
  checklist[itemKey] = wasDone
    ? { done: false }
    : { done: true, by: user.id, at: new Date().toISOString() };

  const { error } = await service
    .from("employees")
    .update({ checklist })
    .eq("id", employeeId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: wasDone ? "employee.checklist.unticked" : "employee.checklist.ticked",
    entityType: "employees",
    entityId: employeeId,
    orgId: employee.organisation_id,
    reason: itemKey,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${employeeId}`);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Employee files (NDA, contract, anything else)
// Stored at employees/<org_slug>/<employee_number>/<filename> in the
// private documents bucket; access enforced by lib/documents/access.ts
// ----------------------------------------------------------------------------
const MAX_EMPLOYEE_FILE_BYTES = 20 * 1024 * 1024;

async function employeeFilePrefix(
  service: ReturnType<typeof createSupabaseServiceClient>,
  employee: { organisation_id: string; employee_number: string },
): Promise<string | null> {
  const { data: org } = await service
    .from("organisations")
    .select("slug")
    .eq("id", employee.organisation_id)
    .single();
  if (!org) return null;
  return `${EMPLOYEE_FILES_ROOT}/${org.slug.toLowerCase()}/${employee.employee_number}`;
}

export async function uploadEmployeeFileAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const employeeId = formData.get("employeeId");
  const file = formData.get("file");
  if (typeof employeeId !== "string") return { error: "Invalid input" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload" };
  }
  if (file.size > MAX_EMPLOYEE_FILE_BYTES) {
    return { error: "File too large (20 MB maximum)" };
  }
  if (!isSafeFileName(file.name)) {
    return { error: "File name can only use letters, numbers, spaces, dots and dashes" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, employee_number")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot update employees in that organisation" };
  }

  const prefix = await employeeFilePrefix(service, employee);
  if (!prefix) return { error: "Organisation not found" };
  const path = `${prefix}/${file.name}`;

  const bytes = await file.arrayBuffer();
  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    if (error.message.toLowerCase().includes("exists")) {
      return { error: "A file with that name already exists for this employee" };
    }
    return { error: error.message };
  }

  await logAudit(service, {
    action: "employee.file.uploaded",
    entityType: "employees",
    entityId: employeeId,
    orgId: employee.organisation_id,
    reason: path,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${employeeId}`);
  return { success: true, message: `Uploaded ${file.name}` };
}

export async function deleteEmployeeFileAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };
  if (!(await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_ARCHIVE))) {
    return { error: "You do not have permission to delete files" };
  }

  const employeeId = formData.get("employeeId");
  const fileName = formData.get("fileName");
  if (typeof employeeId !== "string" || typeof fileName !== "string" || !isSafeFileName(fileName)) {
    return { error: "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, employee_number")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot update employees in that organisation" };
  }

  const prefix = await employeeFilePrefix(service, employee);
  if (!prefix) return { error: "Organisation not found" };

  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .remove([`${prefix}/${fileName}`]);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "employee.file.deleted",
    entityType: "employees",
    entityId: employeeId,
    orgId: employee.organisation_id,
    reason: fileName,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${employeeId}`);
  return { success: true, message: "Deleted" };
}

// ----------------------------------------------------------------------------
// Departure: dismiss (fired) or resign (left voluntarily), and reinstate
// ----------------------------------------------------------------------------
const EMPLOYEE_END_STATUSES = ["dismissed", "resigned"] as const;

export async function setEmployeeStatusAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const employeeId = formData.get("employeeId");
  const status = formData.get("status");
  const reason = formData.get("reason");
  if (typeof employeeId !== "string" || typeof status !== "string") {
    return { error: "Invalid input" };
  }
  const ending = (EMPLOYEE_END_STATUSES as readonly string[]).includes(status);
  if (!ending && status !== "active") {
    return { error: "Invalid status" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, user_id, organisation_id, status, employee_number")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot update employees in that organisation" };
  }
  if (employee.status === status) {
    return { error: `Already ${status}` };
  }

  const endReason =
    typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null;

  const { error: updateErr } = await service
    .from("employees")
    .update(
      ending
        ? { status, ended_at: new Date().toISOString(), end_reason: endReason }
        : { status: "active", ended_at: null, end_reason: null },
    )
    .eq("id", employeeId);
  if (updateErr) return { error: updateErr.message };

  // Ending employment also ends the organisation membership, which strips
  // the person's roles there. If it was their only organisation they lose
  // portal access entirely (accounts survive; they can still apply again).
  if (ending) {
    const { error: memberErr } = await service
      .from("memberships")
      .delete()
      .eq("user_id", employee.user_id)
      .eq("organisation_id", employee.organisation_id);
    if (memberErr) {
      console.error("Membership removal on departure failed:", memberErr.message);
    }
  }

  await logAudit(service, {
    action: ending ? `employee.${status}` : "employee.reinstated",
    entityType: "employees",
    entityId: employeeId,
    orgId: employee.organisation_id,
    reason: endReason,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${employeeId}`);
  revalidatePath("/portal/employment/employees");
  return {
    success: true,
    message: ending
      ? `${employee.employee_number} marked as ${status}; their roles in this organisation were removed`
      : `${employee.employee_number} reinstated. Re-grant their roles from Administration > Users.`,
  };
}

// ----------------------------------------------------------------------------
// Signature requests
// ----------------------------------------------------------------------------
export async function requestSignatureAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const employeeId = formData.get("employeeId");
  const documentPath = formData.get("documentPath");
  const checklistKey = formData.get("checklistKey");
  if (typeof employeeId !== "string" || typeof documentPath !== "string") {
    return { error: "Invalid input" };
  }
  if (!documentPath.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files can be sent for signature" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, user_id, organisation_id, employee_number")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot manage employees in that organisation" };
  }

  const { CHECKLIST_ITEMS } = await import("@/lib/employees/checklist");
  const key =
    typeof checklistKey === "string" &&
    CHECKLIST_ITEMS.some((i) => i.key === checklistKey)
      ? checklistKey
      : null;

  const title = documentPath.split("/").pop() ?? "Document";

  const { data: created, error } = await service
    .from("signature_requests")
    .insert({
      employee_id: employee.id,
      user_id: employee.user_id,
      organisation_id: employee.organisation_id,
      document_path: documentPath,
      title,
      checklist_key: key,
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
    reason: title,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${employeeId}`);
  return {
    success: true,
    message: `Signature requested - it appears on their dashboard`,
  };
}

export async function cancelSignatureAction(formData: FormData) {
  const user = await getActor();
  if (!user) return { error: "Not signed in" };

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("signature_requests")
    .select("id, employee_id, organisation_id, status, title")
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found" };
  if (request.status !== "pending" && request.status !== "pending_employer") {
    return { error: "Only open requests can be cancelled" };
  }

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, request.organisation_id))) {
    return { error: "You cannot manage employees in that organisation" };
  }

  const { error } = await service
    .from("signature_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "signature.cancelled",
    entityType: "signature_requests",
    entityId: requestId,
    orgId: request.organisation_id,
    reason: request.title,
    actor: user.id,
  });

  revalidatePath(`/portal/employment/employees/${request.employee_id}`);
  return { success: true, message: "Request cancelled" };
}
