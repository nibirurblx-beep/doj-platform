import { getUserSession } from "@/lib/auth/session";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { fetchDiscordIdentity, type DiscordIdentity } from "@/lib/discord/oauth";
import { logAudit } from "@/lib/audit";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

function redirectTo(path: string) {
  return NextResponse.redirect(
    new URL(path, process.env.NEXT_PUBLIC_SITE_URL),
    { status: 302 },
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const linkState = cookieStore.get("discord_link_state")?.value;
  const loginState = cookieStore.get("discord_login_state")?.value;
  cookieStore.delete("discord_link_state");
  cookieStore.delete("discord_login_state");

  if (!code || !state) {
    return redirectTo("/auth/login?discord=failed");
  }

  const isLinkFlow = Boolean(linkState && state === linkState);
  const isLoginFlow = Boolean(loginState && state === loginState);
  if (!isLinkFlow && !isLoginFlow) {
    return redirectTo("/auth/login?discord=state_mismatch");
  }

  let identity: DiscordIdentity;
  try {
    identity = await fetchDiscordIdentity(code);
  } catch (error) {
    console.error("Discord OAuth failed:", error);
    return redirectTo(
      isLinkFlow ? "/portal/settings?discord=failed" : "/auth/login?discord=failed",
    );
  }

  return isLinkFlow ? handleLink(identity) : handleLogin(identity);
}

// ----------------------------------------------------------------------------
// Linking: attach identity to the CURRENT session's profile
// ----------------------------------------------------------------------------
async function handleLink(identity: DiscordIdentity) {
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return redirectTo("/auth/login");
  }

  const service = createSupabaseServiceClient();

  const { data: taken } = await service
    .from("profiles")
    .select("id")
    .eq("discord_id", identity.id)
    .neq("id", session.user.id)
    .limit(1);
  if (taken && taken.length > 0) {
    return redirectTo("/portal/settings?discord=already_linked_elsewhere");
  }

  const { error } = await service
    .from("profiles")
    .update({
      discord_id: identity.id,
      discord_username: identity.globalName || identity.username,
      discord_linked_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);
  if (error) {
    console.error("Discord link save failed:", error.message);
    return redirectTo("/portal/settings?discord=failed");
  }

  await logAudit(service, {
    action: "discord.linked",
    entityType: "profile",
    entityId: session.user.id,
    actor: session.user.id,
  });

  return redirectTo("/portal/settings?discord=linked");
}

// ----------------------------------------------------------------------------
// Login: resolve identity to an EXISTING linked account. Never creates users.
// ----------------------------------------------------------------------------
async function handleLogin(identity: DiscordIdentity) {
  const service = createSupabaseServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("discord_id", identity.id)
    .single();

  if (!profile) {
    // Unknown Discord identity: reject, create nothing.
    return redirectTo("/auth/login?discord=not_linked");
  }

  // Suspension check before minting any session
  const { data: security } = await service
    .from("user_security_status")
    .select("suspended_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (security?.suspended_at) {
    return redirectTo("/auth/suspended");
  }

  // Mint a session server-side: generate a one-time magic-link token for
  // the account and verify it immediately. No email is sent; the token
  // never leaves the server.
  const { data: userData, error: userError } =
    await service.auth.admin.getUserById(profile.id);
  if (userError || !userData.user?.email) {
    console.error("Discord login: could not load user", userError?.message);
    return redirectTo("/auth/login?discord=failed");
  }

  const { data: linkData, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("Discord login: generateLink failed", linkError?.message);
    return redirectTo("/auth/login?discord=failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    console.error("Discord login: verifyOtp failed", verifyError.message);
    return redirectTo("/auth/login?discord=failed");
  }

  await logAudit(service, {
    action: "account.login",
    entityType: "auth.user",
    entityId: profile.id,
    actor: profile.id,
    reason: "discord",
  });

  return redirectTo("/portal");
}
