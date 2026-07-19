import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/server";
import { isDiscordConfigured } from "@/lib/discord/oauth";
import { UnlinkDiscordButton } from "./unlink-button";
import { ProfileForm } from "./profile-form";

const DISCORD_MESSAGES: Record<string, { text: string; tone: string }> = {
  linked: { text: "Discord account linked.", tone: "bg-green-50 text-green-800" },
  failed: { text: "Discord linking failed. Try again.", tone: "bg-red-50 text-red-800" },
  state_mismatch: {
    text: "Linking session expired. Try again.",
    tone: "bg-red-50 text-red-800",
  },
  already_linked_elsewhere: {
    text: "That Discord account is already linked to a different user.",
    tone: "bg-red-50 text-red-800",
  },
  unconfigured: {
    text: "Discord linking is not configured yet (see docs/setup-discord.md).",
    tone: "bg-amber-50 text-amber-900",
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const notice = params.discord ? DISCORD_MESSAGES[params.discord] : undefined;

  // Discord fields live on the profile; read with the user's own client (RLS: own row)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: profile } = authUser
    ? await supabase
        .from("profiles")
        .select("discord_username, discord_linked_at")
        .eq("id", authUser.id)
        .single()
    : { data: null };

  const discordConfigured = isDiscordConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Account settings</h1>
      </div>

      {notice && (
        <p className={`rounded px-3 py-2 text-sm ${notice.tone}`}>
          {notice.text}
        </p>
      )}

      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Profile</h2>
        <div className="mt-4">
          <ProfileForm
            displayName={user?.displayName ?? ""}
            email={user?.email ?? ""}
          />
        </div>
        {user?.robloxUsername && (
          <p className="mt-4 text-sm text-grey-600">
            Roblox username: <span className="font-medium">{user.robloxUsername}</span>
          </p>
        )}
      </div>

      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Connected accounts</h2>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Discord</p>
            {profile?.discord_username ? (
              <p className="mt-0.5 text-sm text-grey-600">
                Linked as <strong>{profile.discord_username}</strong>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-grey-600">Not linked</p>
            )}
          </div>

          {profile?.discord_username ? (
            <UnlinkDiscordButton />
          ) : discordConfigured ? (
            <form action="/auth/discord/start" method="post">
              <button
                type="submit"
                className="rounded bg-[#5865F2] px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Connect Discord
              </button>
            </form>
          ) : (
            <p className="text-sm text-grey-500">Not configured</p>
          )}
        </div>
        <p className="mt-3 text-xs text-grey-500">
          Linking identifies your Discord account to staff systems. It is
          never used to sign in.
        </p>
      </div>
    </div>
  );
}
