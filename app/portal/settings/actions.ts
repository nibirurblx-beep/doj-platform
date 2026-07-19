"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function unlinkDiscordAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("profiles")
    .update({
      discord_id: null,
      discord_username: null,
      discord_linked_at: null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "discord.unlinked",
    entityType: "profile",
    entityId: user.id,
    actor: user.id,
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name too short").max(80),
  email: z.string().email("Invalid email").max(200),
  currentPassword: z.string().optional().or(z.literal("")),
});

/** Self-service: change own display name and email. Email changes require
 *  the current password (they move the account, so re-authentication is fair). */
export async function updateOwnProfileAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;
  const service = createSupabaseServiceClient();

  const emailChanged =
    user.email?.toLowerCase() !== input.email.trim().toLowerCase();
  if (emailChanged) {
    if (!input.currentPassword) {
      return { error: "Enter your current password to change your email" };
    }
    const { error: pwErr } = await supabase.auth.signInWithPassword({
      email: user.email ?? "",
      password: input.currentPassword,
    });
    if (pwErr) return { error: "Current password is incorrect" };

    const { error: emailErr } = await service.auth.admin.updateUserById(user.id, {
      email: input.email.trim(),
      email_confirm: true,
    });
    if (emailErr) return { error: `Email change failed: ${emailErr.message}` };
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({ display_name: input.displayName.trim() })
    .eq("id", user.id);
  if (profileErr) return { error: profileErr.message };

  const { logAudit } = await import("@/lib/audit");
  await logAudit(service, {
    action: "user.self.updated",
    entityType: "profiles",
    entityId: user.id,
    after: {
      display_name: input.displayName.trim(),
      ...(emailChanged ? { email: input.email.trim() } : {}),
    },
    actor: user.id,
  });

  revalidatePath("/portal/settings");
  return {
    success: true,
    message: emailChanged ? "Profile and email updated" : "Profile updated",
  };
}
