"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { sendInvitationEmail, sendPasswordResetEmail } from "@/lib/email/resend";
import { generateToken } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { z } from "zod";

// ============================================================================
// Login
// ============================================================================

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function loginAction(formData: FormData) {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    // Generic message to avoid user enumeration
    return { error: "Invalid email or password" };
  }

  // Check suspension
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: status } = await supabase
      .from("user_security_status")
      .select("suspended_at")
      .eq("user_id", user.id)
      .single();

    if (status?.suspended_at) {
      // Sign them out immediately
      await supabase.auth.signOut();
      return {
        error: "Your account has been suspended. Contact an administrator.",
      };
    }

    // Log successful login
    const service = createSupabaseServiceClient();
    await service.rpc("audit_log", {
      p_action: "account.login",
      p_entity_type: "auth.user",
      p_entity_id: user.id,
      p_after: JSON.stringify({ email: user.email }),
    });
  }

  redirect("/portal");
}

// ============================================================================
// Logout
// ============================================================================

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    const service = createSupabaseServiceClient();
    await service.rpc("audit_log", {
      p_action: "account.logout",
      p_entity_type: "auth.user",
      p_entity_id: user.id,
    });
  }

  await supabase.auth.signOut();
  redirect("/");
}

// ============================================================================
// Activation (invitation acceptance)
// ============================================================================

const activateSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required"),
  robloxUsername: z.string().optional(),
});

export async function activateAccountAction(
  token: string,
  formData: FormData,
) {
  const result = activateSchema.safeParse({
    token,
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    robloxUsername: formData.get("robloxUsername"),
  });

  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const service = createSupabaseServiceClient();

  // Verify the invitation
  const { data: invitation } = await service.rpc("verify_invitation", {
    p_token: result.data.token,
  });

  if (!invitation || invitation.length === 0) {
    return { error: "Invalid or expired invitation link" };
  }

  const inv = invitation[0];

  // Create the auth user
  const { data: authData, error: authError } = await service.auth.admin.createUser(
    {
      email: inv.email,
      password: result.data.password,
      email_confirm: true,
      user_metadata: {
        display_name: result.data.displayName,
      },
    }
  );

  if (authError || !authData.user) {
    return { error: "Failed to create account. Email may already be in use." };
  }

  const userId = authData.user.id;

  // Update profile
  await service.from("profiles").update({
    display_name: result.data.displayName,
    roblox_username: result.data.robloxUsername || null,
  }).eq("id", userId);

  // Create membership and assign role
  const { data: membershipData } = await service
    .from("memberships")
    .insert({
      user_id: userId,
      organisation_id: inv.organisation_id,
      office_id: inv.office_id,
      status: "active",
    })
    .select("id")
    .single();

  if (membershipData) {
    await service.from("membership_roles").insert({
      membership_id: membershipData.id,
      role_id: inv.role_id,
      granted_by: inv.invited_by,
    });
  }

  // Mark invitation as accepted
  await service
    .from("invitations")
    .update({
      accepted_at: new Date().toISOString(),
      created_user_id: userId,
    })
    .eq("id", inv.id);

  // Audit log
  await service.rpc("audit_log", {
    p_action: "account.activated",
    p_entity_type: "auth.user",
    p_entity_id: userId,
    p_org_id: inv.organisation_id,
    p_after: JSON.stringify({ email: inv.email }),
  });

  // Audit invitation accepted
  await service.rpc("audit_log", {
    p_action: "invitation.accepted",
    p_entity_type: "invitations",
    p_entity_id: inv.id,
    p_org_id: inv.organisation_id,
  });

  redirect("/portal");
}

// ============================================================================
// Forgot password (request reset link)
// ============================================================================

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function forgotPasswordAction(formData: FormData) {
  const result = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const service = createSupabaseServiceClient();

  // Find the user
  const { data: users } = await service.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === result.data.email);

  if (!user) {
    // Return generic success to avoid user enumeration
    return { success: true };
  }

  // Generate reset token
  const plainToken = generateToken();
  const tokenHash = await hashToken(plainToken);

  await service.from("password_reset_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
  });

  // Send email
  try {
    await sendPasswordResetEmail(result.data.email, plainToken);
  } catch (e) {
    console.error("Failed to send password reset email:", e);
    return { error: "Failed to send email. Try again later." };
  }

  // Audit log
  await service.rpc("audit_log", {
    p_action: "password.reset.requested",
    p_entity_type: "auth.user",
    p_entity_id: user.id,
  });

  return { success: true };
}

// ============================================================================
// Reset password (with token)
// ============================================================================

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPasswordAction(formData: FormData) {
  const result = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const service = createSupabaseServiceClient();

  // Verify the token
  const { data: userId } = await service.rpc("verify_password_reset_token", {
    p_token: result.data.token,
  });

  if (!userId) {
    return { error: "Invalid or expired reset link" };
  }

  // Update password
  const { error: updateError } = await service.auth.admin.updateUserById(userId, {
    password: result.data.password,
  });

  if (updateError) {
    return { error: "Failed to update password" };
  }

  // Mark token as used
  await service.rpc("use_password_reset_token", {
    p_token: result.data.token,
  });

  // Audit log
  await service.rpc("audit_log", {
    p_action: "password.reset.completed",
    p_entity_type: "auth.user",
    p_entity_id: userId,
  });

  return { success: true };
}

// ============================================================================
// Helper: hash token using SHA256 (must match DB function)
// ============================================================================

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
