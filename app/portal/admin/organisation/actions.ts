"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { logAudit } from "@/lib/audit";
import { createDivisionAction as createDivisionInUsers } from "../users/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    return { error: "You do not have permission to manage organisations" as const };
  }
  return { userId: user.id };
}

const STANDARD_ROLE_KEYS = ["staff", "leadership", "content_author"];

// ----------------------------------------------------------------------------
// Organisations
// ----------------------------------------------------------------------------
const createOrgSchema = z.object({
  name: z.string().min(2, "Name too short").max(120),
  slug: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers and dashes only"),
});

export async function createOrganisationAction(formData: FormData) {
  const actor = await requireManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  const service = createSupabaseServiceClient();

  const { data: org, error: orgErr } = await service
    .from("organisations")
    .insert({ name: input.name.trim(), slug: input.slug })
    .select("id")
    .single();
  if (orgErr || !org) {
    if (orgErr?.message.includes("duplicate")) {
      return { error: "An organisation with that slug or name already exists" };
    }
    return { error: orgErr?.message || "Could not create organisation" };
  }

  // Clone the standard roles + their permissions from an existing org so
  // the new organisation is usable immediately.
  const { data: templateOrg } = await service
    .from("organisations")
    .select("id")
    .neq("id", org.id)
    .order("created_at")
    .limit(1)
    .single();

  const roleWarnings: string[] = [];
  if (templateOrg) {
    for (const key of STANDARD_ROLE_KEYS) {
      const { data: templateRole } = await service
        .from("roles")
        .select("id, name, description")
        .eq("organisation_id", templateOrg.id)
        .eq("key", key)
        .maybeSingle();
      if (!templateRole) {
        roleWarnings.push(key);
        continue;
      }

      const { data: newRole, error: roleErr } = await service
        .from("roles")
        .insert({
          organisation_id: org.id,
          key,
          name: templateRole.name,
          description: templateRole.description,
        })
        .select("id")
        .single();
      if (roleErr || !newRole) {
        roleWarnings.push(key);
        continue;
      }

      const { data: perms } = await service
        .from("role_permissions")
        .select("permission_id, scope")
        .eq("role_id", templateRole.id);
      if (perms && perms.length > 0) {
        await service.from("role_permissions").insert(
          perms.map((p) => ({
            role_id: newRole.id,
            permission_id: p.permission_id,
            scope: p.scope,
          })),
        );
      }
    }
  }

  await logAudit(service, {
    action: "organisation.created",
    entityType: "organisations",
    entityId: org.id,
    orgId: org.id,
    reason: `${input.name.trim()} (${input.slug})`,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/organisation");
  return {
    success: true,
    message:
      roleWarnings.length > 0
        ? `Created ${input.name.trim()}, but roles could not be cloned (${roleWarnings.join(", ")})`
        : `Created ${input.name.trim()} with standard roles`,
  };
}

const renameOrgSchema = z.object({
  organisationId: z.string().uuid(),
  name: z.string().min(2, "Name too short").max(120),
});

export async function renameOrganisationAction(formData: FormData) {
  const actor = await requireManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = renameOrgSchema.safeParse({
    organisationId: formData.get("organisationId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("organisations")
    .update({ name: parsed.data.name.trim() })
    .eq("id", parsed.data.organisationId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "organisation.renamed",
    entityType: "organisations",
    entityId: parsed.data.organisationId,
    orgId: parsed.data.organisationId,
    reason: parsed.data.name.trim(),
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/organisation");
  return { success: true, message: "Renamed" };
}

export async function deleteOrganisationAction(formData: FormData) {
  const actor = await requireManager();
  if ("error" in actor) return { error: actor.error };

  const organisationId = formData.get("organisationId");
  if (typeof organisationId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();

  // Refuse while anything meaningful still references the organisation
  const [members, employees, vacancies, invitations] = await Promise.all([
    service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
    service
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
    service
      .from("vacancies")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
    service
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
  ]);

  const blockers: string[] = [];
  if ((members.count ?? 0) > 0) blockers.push(`${members.count} member(s)`);
  if ((employees.count ?? 0) > 0) blockers.push(`${employees.count} employee(s)`);
  if ((vacancies.count ?? 0) > 0) blockers.push(`${vacancies.count} vacanc(ies)`);
  if ((invitations.count ?? 0) > 0) blockers.push(`${invitations.count} invitation(s)`);
  if (blockers.length > 0) {
    return {
      error: `Cannot delete: the organisation still has ${blockers.join(", ")}. Remove those first.`,
    };
  }

  const { data: org } = await service
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .single();

  // Audit before the row disappears
  await logAudit(service, {
    action: "organisation.deleted",
    entityType: "organisations",
    entityId: organisationId,
    reason: org?.name ?? organisationId,
    actor: actor.userId,
  });

  // Clear the org's own configuration, then the org itself
  const { data: orgRoles } = await service
    .from("roles")
    .select("id")
    .eq("organisation_id", organisationId);
  const roleIds = (orgRoles ?? []).map((r) => r.id);
  if (roleIds.length > 0) {
    await service.from("role_permissions").delete().in("role_id", roleIds);
    const { error: rolesErr } = await service.from("roles").delete().in("id", roleIds);
    if (rolesErr) return { error: `Could not remove roles: ${rolesErr.message}` };
  }
  const { error: officesErr } = await service
    .from("offices")
    .delete()
    .eq("organisation_id", organisationId);
  if (officesErr) return { error: `Could not remove divisions: ${officesErr.message}` };

  const { error } = await service
    .from("organisations")
    .delete()
    .eq("id", organisationId);
  if (error) return { error: error.message };

  revalidatePath("/portal/admin/organisation");
  return { success: true, message: `Deleted ${org?.name ?? "organisation"}` };
}

// ----------------------------------------------------------------------------
// Divisions
// ----------------------------------------------------------------------------
const renameDivisionSchema = z.object({
  officeId: z.string().uuid(),
  name: z.string().min(2, "Name too short").max(120),
});

export async function renameDivisionAction(formData: FormData) {
  const actor = await requireManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = renameDivisionSchema.safeParse({
    officeId: formData.get("officeId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { data: office } = await service
    .from("offices")
    .select("organisation_id")
    .eq("id", parsed.data.officeId)
    .single();
  if (!office) return { error: "Division not found" };

  const { error } = await service
    .from("offices")
    .update({ name: parsed.data.name.trim() })
    .eq("id", parsed.data.officeId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "division.renamed",
    entityType: "offices",
    entityId: parsed.data.officeId,
    orgId: office.organisation_id,
    reason: parsed.data.name.trim(),
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/organisation");
  return { success: true, message: "Renamed" };
}

export async function deleteDivisionAction(formData: FormData) {
  const actor = await requireManager();
  if ("error" in actor) return { error: actor.error };

  const officeId = formData.get("officeId");
  if (typeof officeId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: office } = await service
    .from("offices")
    .select("name, organisation_id")
    .eq("id", officeId)
    .single();
  if (!office) return { error: "Division not found" };

  // Memberships/employees/invitations null out automatically (FK set null).
  // Child divisions block deletion (FK restrict) - surfaced as an error.
  await logAudit(service, {
    action: "division.deleted",
    entityType: "offices",
    entityId: officeId,
    orgId: office.organisation_id,
    reason: office.name,
    actor: actor.userId,
  });

  const { error } = await service.from("offices").delete().eq("id", officeId);
  if (error) {
    if (error.message.includes("violates foreign key")) {
      return { error: "Delete this division's child divisions first" };
    }
    return { error: error.message };
  }

  revalidatePath("/portal/admin/organisation");
  return { success: true, message: `Deleted ${office.name}` };
}

// Wrapper so this page's widgets import everything from one module
// (bare re-exports are not allowed in "use server" files)
export async function createDivisionAction(formData: FormData) {
  return createDivisionInUsers(formData);
}
