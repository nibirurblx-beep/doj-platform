"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireUsersManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    return { error: "You do not have permission to manage users" as const };
  }
  return { userId: user.id };
}

// ----------------------------------------------------------------------------
// Grant a role (creates the membership if needed)
// ----------------------------------------------------------------------------
const grantSchema = z.object({
  userId: z.string().uuid(),
  organisationId: z.string().uuid("Choose an organisation"),
  roleId: z.string().uuid("Choose a role"),
});

export async function grantRoleAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = grantSchema.safeParse({
    userId: formData.get("userId"),
    organisationId: formData.get("organisationId"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  const service = createSupabaseServiceClient();

  // Role must be org-scoped to the chosen organisation, or global
  const { data: role } = await service
    .from("roles")
    .select("id, name, organisation_id")
    .eq("id", input.roleId)
    .single();
  if (!role) return { error: "Role not found" };
  const isGlobal = role.organisation_id === null;
  if (!isGlobal && role.organisation_id !== input.organisationId) {
    return { error: "That role does not belong to the chosen organisation" };
  }

  const { data: membership } = await service
    .from("memberships")
    .select("id")
    .eq("user_id", input.userId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();

  let membershipId = membership?.id;
  if (!membershipId) {
    const { data: created, error: mErr } = await service
      .from("memberships")
      .insert({ user_id: input.userId, organisation_id: input.organisationId })
      .select("id")
      .single();
    if (mErr || !created) return { error: mErr?.message || "Membership failed" };
    membershipId = created.id;
  }

  const { error: rErr } = await service
    .from("membership_roles")
    .insert({ membership_id: membershipId, role_id: input.roleId });
  if (rErr) {
    if (rErr.message.includes("duplicate")) {
      return { error: "The user already has that role there" };
    }
    return { error: rErr.message };
  }

  await logAudit(service, {
    action: "user.role.granted",
    entityType: "membership_roles",
    entityId: membershipId,
    orgId: input.organisationId,
    reason: role.name,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: `Granted ${role.name}` };
}

// ----------------------------------------------------------------------------
// Revoke a role
// ----------------------------------------------------------------------------
export async function revokeRoleAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const membershipRoleId = formData.get("membershipRoleId");
  if (typeof membershipRoleId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: mr } = await service
    .from("membership_roles")
    .select("id, role_id, membership_id, roles(name), memberships(organisation_id, user_id)")
    .eq("id", membershipRoleId)
    .single();
  if (!mr) return { error: "Role assignment not found" };

  const membership = mr.memberships as unknown as {
    organisation_id: string;
    user_id: string;
  } | null;

  // Guard: don't let an admin strip their own last users.manage grant
  if (membership?.user_id === actor.userId) {
    return { error: "You cannot revoke your own roles. Ask another administrator." };
  }

  const { error } = await service
    .from("membership_roles")
    .delete()
    .eq("id", membershipRoleId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "user.role.revoked",
    entityType: "membership_roles",
    entityId: membershipRoleId,
    orgId: membership?.organisation_id ?? null,
    reason: (mr.roles as unknown as { name: string } | null)?.name ?? null,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: "Role revoked" };
}

// ----------------------------------------------------------------------------
// Suspend / unsuspend
// ----------------------------------------------------------------------------
export async function suspendUserAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const userId = formData.get("userId");
  const reason = formData.get("reason");
  if (typeof userId !== "string") return { error: "Invalid input" };
  if (userId === actor.userId) return { error: "You cannot suspend yourself" };

  const service = createSupabaseServiceClient();
  const { error } = await service.from("user_security_status").upsert({
    user_id: userId,
    suspended_at: new Date().toISOString(),
    suspended_by: actor.userId,
    suspension_reason: typeof reason === "string" && reason ? reason.slice(0, 500) : null,
  });
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "account.suspended",
    entityType: "auth.user",
    entityId: userId,
    reason: typeof reason === "string" ? reason.slice(0, 500) : null,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: "User suspended" };
}

export async function unsuspendUserAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const userId = formData.get("userId");
  if (typeof userId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("user_security_status")
    .update({ suspended_at: null, suspended_by: null, suspension_reason: null })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "account.unsuspended",
    entityType: "auth.user",
    entityId: userId,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: "Suspension lifted" };
}

// ----------------------------------------------------------------------------
// Divisions (offices table)
// ----------------------------------------------------------------------------
const divisionSchema = z.object({
  organisationId: z.string().uuid("Choose an organisation"),
  name: z.string().min(2, "Name too short").max(120),
});

export async function createDivisionAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = divisionSchema.safeParse({
    organisationId: formData.get("organisationId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { data: division, error } = await service
    .from("offices")
    .insert({
      organisation_id: parsed.data.organisationId,
      name: parsed.data.name.trim(),
    })
    .select("id")
    .single();
  if (error || !division) {
    if (error?.message.includes("duplicate")) {
      return { error: "A division with that name already exists there" };
    }
    return { error: error?.message || "Could not create division" };
  }

  await logAudit(service, {
    action: "division.created",
    entityType: "offices",
    entityId: division.id,
    orgId: parsed.data.organisationId,
    reason: parsed.data.name.trim(),
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: `Created ${parsed.data.name.trim()}` };
}
