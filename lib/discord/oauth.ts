import "server-only";

/**
 * Discord OAuth for ACCOUNT LINKING only. This flow never creates users
 * and never signs anyone in: it attaches a Discord identity to the
 * already-authenticated session's profile.
 *
 * Environment (docs/setup-discord.md):
 *   DISCORD_CLIENT_ID
 *   DISCORD_CLIENT_SECRET
 */

export function isDiscordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
  );
}

export function discordRedirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("NEXT_PUBLIC_SITE_URL not set");
  return `${site.replace(/\/$/, "")}/auth/discord/callback`;
}

export function discordAuthorizeUrl(state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("DISCORD_CLIENT_ID not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordIdentity {
  id: string;
  username: string;
  globalName: string | null;
}

/** Exchange the authorization code, then fetch the user's identity. */
export async function fetchDiscordIdentity(
  code: string,
): Promise<DiscordIdentity> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Discord is not configured");
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("Discord token exchange failed");
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("Discord token exchange returned no token");
  }

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error("Could not fetch Discord identity");
  }
  const user = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
  };

  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name ?? null,
  };
}
