import { generateToken } from "@/lib/auth/session";
import {
  discordAuthorizeUrl,
  isDiscordConfigured,
} from "@/lib/discord/oauth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Begin "Sign in with Discord". Distinct from linking: no session is
 * required here, and the callback will only ever resolve to an EXISTING
 * account whose profile has this Discord identity linked. Unknown
 * identities are rejected; no user is ever created by this flow.
 */
export async function POST() {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL("/auth/login?discord=unconfigured", process.env.NEXT_PUBLIC_SITE_URL),
      { status: 302 },
    );
  }

  const state = generateToken();
  const cookieStore = await cookies();
  cookieStore.set("discord_login_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(discordAuthorizeUrl(state), { status: 302 });
}
