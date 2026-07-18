import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const service = createSupabaseServiceClient();
    await logAudit(service, {
      action: "account.logout",
      entityType: "auth.user",
      entityId: user.id,
      actor: user.id,
    });
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL), {
    status: 302,
  });
}
