"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere, userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const convertSchema = z.object({
  applicationId: z.string().uuid(),
  organisationId: z.string().uuid("Choose an organisation"),
  roleId: z.string().uuid("Choose a role"),
  officeId: z.string().uuid().optional().or(z.literal("")),
  rank: z.string().max(80).optional().or(z.literal("")),
  title: z.string().max(120).optional().or(z.literal("")),
});

export async function convertApplicantAction(formData: FormData) {
  const parsed = convertSchema.safeParse({
    applicationId: formData.get("applicationId"),
    organisationId: formData.get("organisationId"),
    roleId: formData.get("roleId"),
    officeId: formData.get("officeId") ?? "",
    rank: formData.get("rank") ?? "",
    title: "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Creating an employee grants portal access: require employees.create
  // in the TARGET organisation, not just anywhere.
  const allowed = await userHasPermission(
    PERMISSIONS.EMPLOYEES_CREATE,
    input.organisationId,
  );
  if (!allowed) {
    return { error: "You do not have permission to create employees in this organisation" };
  }

  const service = createSupabaseServiceClient();

  // Application must exist and be accepted
  const { data: application } = await service
    .from("applications")
    .select("id, user_id, status")
    .eq("id", input.applicationId)
    .single();
  if (!application) return { error: "Application not found" };
  if (application.status !== "accepted") {
    return { error: "Only accepted applications can be converted" };
  }

  // Already an employee of this organisation?
  const { data: existingEmployee } = await service
    .from("employees")
    .select("id")
    .eq("user_id", application.user_id)
    .eq("organisation_id", input.organisationId)
    .limit(1);
  if (existingEmployee && existingEmployee.length > 0) {
    return { error: "This person is already an employee of that organisation" };
  }

  // Role must belong to the target organisation (never global roles here:
  // that would allow privilege escalation to platform administrator).
  const { data: role } = await service
    .from("roles")
    .select("id, organisation_id")
    .eq("id", input.roleId)
    .single();
  if (!role || role.organisation_id !== input.organisationId) {
    return { error: "Role must belong to the chosen organisation" };
  }

  // Office consistency
  if (input.officeId) {
    const { data: office } = await service
      .from("offices")
      .select("id, organisation_id")
      .eq("id", input.officeId)
      .single();
    if (!office || office.organisation_id !== input.organisationId) {
      return { error: "Office must belong to the chosen organisation" };
    }
  }

  const { data: org } = await service
    .from("organisations")
    .select("slug")
    .eq("id", input.organisationId)
    .single();
  if (!org) return { error: "Organisation not found" };

  // 1. Membership (idempotent-ish: reactivate if inactive)
  const { data: membership, error: membershipError } = await service
    .from("memberships")
    .upsert(
      {
        user_id: application.user_id,
        organisation_id: input.organisationId,
        office_id: input.officeId || null,
        status: "active",
      },
      { onConflict: "user_id,organisation_id" },
    )
    .select("id")
    .single();
  if (membershipError || !membership) {
    return { error: membershipError?.message || "Failed to create membership" };
  }

  // 2. Role grant
  const { error: roleError } = await service.from("membership_roles").upsert(
    {
      membership_id: membership.id,
      role_id: input.roleId,
      granted_by: user.id,
    },
    { onConflict: "membership_id,role_id" },
  );
  if (roleError) return { error: roleError.message };

  // 3. Employee record with number
  const { data: numberResult, error: numberError } = await service.rpc(
    "next_employee_number",
    { p_org_slug: org.slug },
  );
  if (numberError || !numberResult) {
    return { error: "Failed to generate employee number" };
  }

  const { data: employee, error: employeeError } = await service
    .from("employees")
    .insert({
      employee_number: numberResult as string,
      user_id: application.user_id,
      organisation_id: input.organisationId,
      office_id: input.officeId || null,
      rank: input.rank || null,
      title: input.title || null,
    })
    .select("id, employee_number")
    .single();
  if (employeeError || !employee) {
    return { error: employeeError?.message || "Failed to create employee record" };
  }

  await logAudit(service, {
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    orgId: input.organisationId,
    after: { from_application: input.applicationId },
    actor: user.id,
  });

  revalidatePath(`/portal/admin/applications/${input.applicationId}`);
  revalidatePath("/portal/admin/employees");
  return {
    success: true,
    message: `Employee created: ${employee.employee_number}`,
  };
}
