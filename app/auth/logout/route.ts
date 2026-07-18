import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { NextResponse } from "next/server";

export async function POST() {
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
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL), {
    status: 302,
  });
}
