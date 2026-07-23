"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { logAudit } from "@/lib/audit";
import { isOwnerEmail, ownerEmail } from "@/lib/auth/owner";
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
  return { userId: user.id, email: user.email ?? null };
}

/** Global roles (Platform Administrator) may only be granted/revoked by the owner. */
function requireOwnerForGlobalRoles(actorEmail: string | null):
  | { ok: true }
  | { ok: false; error: string } {
  if (!ownerEmail()) {
    return {
      ok: false,
      error:
        "Global role changes are locked: set OWNER_EMAIL in the environment to the owner's login email first.",
    };
  }
  if (!isOwnerEmail(actorEmail)) {
    return {
      ok: false,
      error: "Only the platform owner can grant or revoke global roles.",
    };
  }
  return { ok: true };
}

async function isOwnerAccount(
  service: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
): Promise<boolean> {
  const { data } = await service.auth.admin.getUserById(userId);
  return isOwnerEmail(data.user?.email ?? null);
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
  if (isGlobal) {
    const ownerCheck = requireOwnerForGlobalRoles(actor.email);
    if (!ownerCheck.ok) return { error: ownerCheck.error };
  }
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

  const membershipId = formData.get("membershipId");
  const roleId = formData.get("roleId");
  if (typeof membershipId !== "string" || typeof roleId !== "string") {
    return { error: "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  // membership_roles is keyed by (membership_id, role_id) - no id column
  const { data: mr } = await service
    .from("membership_roles")
    .select("role_id, membership_id, roles(name, organisation_id), memberships(organisation_id, user_id)")
    .eq("membership_id", membershipId)
    .eq("role_id", roleId)
    .single();
  if (!mr) return { error: "Role assignment not found" };

  const membership = mr.memberships as unknown as {
    organisation_id: string;
    user_id: string;
  } | null;
  const role = mr.roles as unknown as {
    name: string;
    organisation_id: string | null;
  } | null;

  // Global roles can only be revoked by the owner
  if (role && role.organisation_id === null) {
    const ownerCheck = requireOwnerForGlobalRoles(actor.email);
    if (!ownerCheck.ok) return { error: ownerCheck.error };
  }

  // Guard: don't let an admin strip their own last users.manage grant
  if (membership?.user_id === actor.userId && !isOwnerEmail(actor.email)) {
    return { error: "You cannot revoke your own roles. Ask another administrator." };
  }

  const { error } = await service
    .from("membership_roles")
    .delete()
    .eq("membership_id", membershipId)
    .eq("role_id", roleId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "user.role.revoked",
    entityType: "membership_roles",
    entityId: membershipId,
    orgId: membership?.organisation_id ?? null,
    reason: role?.name ?? null,
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
  if ((await isOwnerAccount(service, userId)) && !isOwnerEmail(actor.email)) {
    return { error: "The platform owner cannot be suspended" };
  }
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

  // offices.slug is required and unique per organisation
  const slug = parsed.data.name
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "division";

  const { data: division, error } = await service
    .from("offices")
    .insert({
      organisation_id: parsed.data.organisationId,
      name: parsed.data.name.trim(),
      slug,
    })
    .select("id")
    .single();
  if (error || !division) {
    if (error?.message.includes("duplicate")) {
      return { error: "A division with that (or a very similar) name already exists there" };
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

// ----------------------------------------------------------------------------
// Edit user info (display name, Roblox username, email)
// ----------------------------------------------------------------------------
const updateUserSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(2, "Display name too short").max(80),
  robloxUsername: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").max(200),
});

export async function updateUserAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    displayName: formData.get("displayName"),
    robloxUsername: formData.get("robloxUsername") ?? "",
    email: formData.get("email"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  const service = createSupabaseServiceClient();

  // Email change goes through auth (kept confirmed so no verification email)
  const { data: current } = await service.auth.admin.getUserById(input.userId);
  if (!current.user) return { error: "User not found" };

  if (current.user.email?.toLowerCase() !== input.email.toLowerCase()) {
    const { error: emailErr } = await service.auth.admin.updateUserById(
      input.userId,
      { email: input.email, email_confirm: true },
    );
    if (emailErr) return { error: `Email change failed: ${emailErr.message}` };
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      display_name: input.displayName.trim(),
      roblox_username: input.robloxUsername?.trim() || null,
    })
    .eq("id", input.userId);
  if (profileErr) return { error: profileErr.message };

  await logAudit(service, {
    action: "user.updated",
    entityType: "profiles",
    entityId: input.userId,
    after: {
      display_name: input.displayName.trim(),
      roblox_username: input.robloxUsername?.trim() || null,
      email: input.email,
    },
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: "User updated" };
}

// ----------------------------------------------------------------------------
// Change division on a membership
// ----------------------------------------------------------------------------
export async function setMembershipDivisionAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const membershipId = formData.get("membershipId");
  const officeId = formData.get("officeId");
  if (typeof membershipId !== "string" || typeof officeId !== "string") {
    return { error: "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { data: membership } = await service
    .from("memberships")
    .select("id, organisation_id")
    .eq("id", membershipId)
    .single();
  if (!membership) return { error: "Membership not found" };

  if (officeId) {
    const { data: office } = await service
      .from("offices")
      .select("id, organisation_id")
      .eq("id", officeId)
      .single();
    if (!office || office.organisation_id !== membership.organisation_id) {
      return { error: "That division does not belong to the membership's organisation" };
    }
  }

  const { error } = await service
    .from("memberships")
    .update({ office_id: officeId || null })
    .eq("id", membershipId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "user.division.changed",
    entityType: "memberships",
    entityId: membershipId,
    orgId: membership.organisation_id,
    reason: officeId || "none",
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/users");
  return { success: true, message: "Division updated" };
}

// ----------------------------------------------------------------------------
// Delete a user account (permanent)
// ----------------------------------------------------------------------------
export async function deleteUserAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const userId = formData.get("userId");
  if (typeof userId !== "string") return { error: "Invalid input" };
  if (userId === actor.userId) return { error: "You cannot delete your own account" };

  const service = createSupabaseServiceClient();
  if (await isOwnerAccount(service, userId)) {
    return { error: "The platform owner account cannot be deleted" };
  }

  const { data: target } = await service.auth.admin.getUserById(userId);
  if (!target.user) return { error: "User not found" };
  const targetEmail = target.user.email ?? userId;

  // employees.user_id is ON DELETE RESTRICT: clear employee records first
  const { error: empErr } = await service
    .from("employees")
    .delete()
    .eq("user_id", userId);
  if (empErr) return { error: `Could not remove employee records: ${empErr.message}` };

  // Audit BEFORE deletion so the entry is written even though the entity goes
  await logAudit(service, {
    action: "account.deleted",
    entityType: "auth.user",
    entityId: userId,
    reason: targetEmail,
    actor: actor.userId,
  });

  // profiles, memberships, security status, applications all cascade
  const { error: delErr } = await service.auth.admin.deleteUser(userId);
  if (delErr) return { error: delErr.message };

  revalidatePath("/portal/admin/users");
  return { success: true, message: `Deleted ${targetEmail}` };
}

/** Generate a one-time password reset link for DMing to a user directly -
 *  closes the gap when email delivery is unavailable. */
export async function generateResetLinkAction(formData: FormData) {
  const actor = await requireUsersManager();
  if ("error" in actor) return { error: actor.error };

  const userId = formData.get("userId");
  if (typeof userId !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: target } = await service.auth.admin.getUserById(userId);
  if (!target.user?.email) return { error: "User not found" };

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { data, error } = await service.auth.admin.generateLink({
    type: "recovery",
    email: target.user.email,
    options: { redirectTo: `${site}/auth/reset` },
  });
  if (error || !data.properties?.action_link) {
    return { error: error?.message || "Could not generate the link" };
  }

  await logAudit(service, {
    action: "user.reset_link_generated",
    entityType: "auth.user",
    entityId: userId,
    actor: actor.userId,
  });

  return {
    success: true,
    message:
      "One-time reset link generated. Send it to this person only - it lets whoever opens it set a new password on their account.",
    resetLink: data.properties.action_link,
  };
}
