import { getUserSession } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { fetchDiscordIdentity } from "@/lib/discord/oauth";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/audit";

function settingsRedirect(result: string) {
  return NextResponse.redirect(
    new URL(`/portal/settings?discord=${result}`, process.env.NEXT_PUBLIC_SITE_URL),
    { status: 302 },
  );
}

export async function GET(request: NextRequest) {
  // Must already be signed in: this endpoint NEVER creates users or sessions.
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return NextResponse.redirect(
      new URL("/auth/login", process.env.NEXT_PUBLIC_SITE_URL),
      { status: 302 },
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("discord_link_state")?.value;
  cookieStore.delete("discord_link_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect("state_mismatch");
  }

  let identity;
  try {
    identity = await fetchDiscordIdentity(code);
  } catch (error) {
    console.error("Discord linking failed:", error);
    return settingsRedirect("failed");
  }

  const service = createSupabaseServiceClient();

  // A Discord identity can only be attached to one platform account
  const { data: taken } = await service
    .from("profiles")
    .select("id")
    .eq("discord_id", identity.id)
    .neq("id", session.user.id)
    .limit(1);
  if (taken && taken.length > 0) {
    return settingsRedirect("already_linked_elsewhere");
  }

  const { error: updateError } = await service
    .from("profiles")
    .update({
      discord_id: identity.id,
      discord_username: identity.globalName || identity.username,
      discord_linked_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);
  if (updateError) {
    console.error("Discord link save failed:", updateError.message);
    return settingsRedirect("failed");
  }

  await logAudit(service, {
    action: "discord.linked",
    entityType: "profile",
    entityId: session.user.id,
    actor: session.user.id,
  });

  return settingsRedirect("linked");
}
