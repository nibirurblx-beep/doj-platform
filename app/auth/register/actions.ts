"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name required").max(80),
  robloxUsername: z.string().max(50).optional().or(z.literal("")),
  next: z.string().max(200).optional().or(z.literal("")),
});

export async function registerApplicantAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    robloxUsername: formData.get("robloxUsername") ?? "",
    next: formData.get("next") ?? "",
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }
  if (!signUp.user) {
    return { error: "Registration failed. Please try again." };
  }

  // Profile row is auto-created by trigger; fill in the display details.
  const service = createSupabaseServiceClient();
  await service
    .from("profiles")
    .update({
      display_name: input.displayName,
      roblox_username: input.robloxUsername || null,
    })
    .eq("id", signUp.user.id);

  await service.rpc("audit_log", {
    p_action: "account.registered",
    p_entity_type: "auth.user",
    p_entity_id: signUp.user.id,
  });

  // If the Supabase project requires email confirmation there is no session
  // yet: show the confirmation notice rather than redirecting.
  if (!signUp.session) {
    return {
      success: true,
      needsConfirmation: true,
      message:
        "Check your email to confirm your account, then sign in.",
    };
  }

  // Internal redirect targets only (prevents open redirects)
  const target =
    input.next && input.next.startsWith("/") && !input.next.startsWith("//")
      ? input.next
      : "/applicant";
  redirect(target);
}
