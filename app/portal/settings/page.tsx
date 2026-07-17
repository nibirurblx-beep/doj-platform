import { getCurrentUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Account settings</h1>
      </div>

      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm text-grey-600">Display name</p>
            <p className="mt-1 text-sm font-medium">{user?.displayName}</p>
          </div>
          <div>
            <p className="text-sm text-grey-600">Email</p>
            <p className="mt-1 text-sm font-medium">{user?.email}</p>
          </div>
          {user?.robloxUsername && (
            <div>
              <p className="text-sm text-grey-600">Roblox username</p>
              <p className="mt-1 text-sm font-medium">{user.robloxUsername}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Connected accounts</h2>
        <p className="mt-2 text-sm text-grey-600">
          Discord account linking arrives in Phase 1I.
        </p>
      </div>
    </div>
  );
}
