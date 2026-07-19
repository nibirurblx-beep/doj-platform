import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isDiscordConfigured } from "@/lib/discord/oauth";

export const metadata: Metadata = { title: "Sign in" };

const DISCORD_NOTICES: Record<string, string> = {
  not_linked:
    "No account is linked to that Discord. Sign in with email, then connect Discord in Settings.",
  failed: "Discord sign-in failed. Try again or use email.",
  state_mismatch: "Sign-in session expired. Try again.",
  unconfigured: "Discord sign-in is not configured.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;
  const notice = params.discord ? DISCORD_NOTICES[params.discord] : undefined;
  const discordAvailable = isDiscordConfigured();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="text-sm text-grey-600">
        Enter your email and password to access the portal.
      </p>
      {notice && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <LoginForm next={next} />
      {discordAvailable && (
        <form action="/auth/discord/login" method="post">
          <button
            type="submit"
            className="w-full rounded bg-[#5865F2] px-4 py-2.5 text-sm text-white hover:opacity-90"
          >
            Sign in with Discord
          </button>
          <p className="mt-2 text-center text-xs text-grey-500">
            Works once Discord is connected to your account in Settings.
          </p>
        </form>
      )}
      <p className="text-center text-sm text-grey-600">
        Applying for a position?{" "}
        <a href="/auth/register" className="text-navy-900 underline">
          Create an applicant account
        </a>
      </p>
    </div>
  );
}
