"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { sendInvitationEmail } from "@/lib/email/resend";
import { generateToken } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  organisationId: z.string().uuid("Choose an organisation"),
  roleId: z.string().uuid("Choose a role"),
  officeId: z.string().uuid().optional().or(z.literal("")),
  robloxUsername: z.string().max(50).optional().or(z.literal("")),
  discordUsername: z.string().max(50).optional().or(z.literal("")),
});

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createInvitationAction(formData: FormData) {
  const result = inviteSchema.safeParse({
    email: formData.get("email"),
    organisationId: formData.get("organisationId"),
    roleId: formData.get("roleId"),
    officeId: formData.get("officeId") ?? "",
    robloxUsername: formData.get("robloxUsername") ?? "",
    discordUsername: formData.get("discordUsername") ?? "",
  });

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const input = result.data;

  // Authenticate the actor
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  // Authorise: users.invite in the target organisation (server-side, never trusted from client)
  const allowed = await userHasPermission(
    PERMISSIONS.USERS_INVITE,
    input.organisationId,
  );
  if (!allowed) {
    return { error: "You do not have permission to invite users to this organisation" };
  }

  const service = createSupabaseServiceClient();

  // Block duplicate live invitations for the same email
  const { data: existing } = await service
    .from("invitations")
    .select("id")
    .eq("email", input.email.toLowerCase())
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: "An active invitation already exists for this email" };
  }

  // Verify the role belongs to the chosen organisation (or is global)
  const { data: role } = await service
    .from("roles")
    .select("id, organisation_id")
    .eq("id", input.roleId)
    .single();

  if (!role || (role.organisation_id !== null && role.organisation_id !== input.organisationId)) {
    return { error: "Role does not belong to the chosen organisation" };
  }

  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);

  const { data: invitation, error: insertError } = await service
    .from("invitations")
    .insert({
      email: input.email.toLowerCase(),
      token_hash: tokenHash,
      role_id: input.roleId,
      organisation_id: input.organisationId,
      office_id: input.officeId || null,
      roblox_username: input.robloxUsername || null,
      discord_username: input.discordUsername || null,
      invited_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !invitation) {
    console.error("Invitation insert failed:", insertError?.message);
    return { error: insertError?.message || "Failed to create invitation" };
  }

  // Send the email. If it fails, revoke the row so no orphan invitation exists.
  try {
    await sendInvitationEmail(input.email, plainToken);
  } catch (emailError) {
    await service
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitation.id);
    const message =
      emailError instanceof Error ? emailError.message : "Email delivery failed";
    return { error: message };
  }

  await service.rpc("audit_log", {
    p_action: "invitation.sent",
    p_entity_type: "invitation",
    p_entity_id: invitation.id,
  });

  revalidatePath("/portal/admin/invitations");
  return { success: true, message: `Invitation sent to ${input.email}` };
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return { error: "Missing invitation" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  const service = createSupabaseServiceClient();

  const { data: invitation } = await service
    .from("invitations")
    .select("id, organisation_id, accepted_at, revoked_at")
    .eq("id", invitationId)
    .single();

  if (!invitation) {
    return { error: "Invitation not found" };
  }
  if (invitation.accepted_at) {
    return { error: "Invitation already accepted; suspend the user instead" };
  }
  if (invitation.revoked_at) {
    return { error: "Invitation already revoked" };
  }

  const allowed = await userHasPermission(
    PERMISSIONS.USERS_INVITE,
    invitation.organisation_id,
  );
  if (!allowed) {
    return { error: "You do not have permission to manage invitations for this organisation" };
  }

  await service
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId);

  await service.rpc("audit_log", {
    p_action: "invitation.revoked",
    p_entity_type: "invitation",
    p_entity_id: invitationId,
  });

  revalidatePath("/portal/admin/invitations");
  return { success: true, message: "Invitation revoked" };
}
