"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { revalidatePath } from "next/cache";

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
