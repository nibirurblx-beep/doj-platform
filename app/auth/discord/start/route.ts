import { getUserSession } from "@/lib/auth/session";
import { generateToken } from "@/lib/auth/session";
import {
  discordAuthorizeUrl,
  isDiscordConfigured,
} from "@/lib/discord/oauth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  // Linking requires an authenticated, non-suspended session — always.
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return NextResponse.redirect(
      new URL("/auth/login", process.env.NEXT_PUBLIC_SITE_URL),
      { status: 302 },
    );
  }
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL("/portal/settings?discord=unconfigured", process.env.NEXT_PUBLIC_SITE_URL),
      { status: 302 },
    );
  }

  // CSRF state: random value in an httpOnly cookie, echoed back by Discord
  const state = generateToken();
  const cookieStore = await cookies();
  cookieStore.set("discord_link_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(discordAuthorizeUrl(state), { status: 302 });
}
