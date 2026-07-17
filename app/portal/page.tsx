import { getUserSession } from "@/lib/auth/session";

export default async function PortalPage() {
  const session = await getUserSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Welcome</h1>
        <p className="mt-2 text-grey-600">
          Portal functionality arrives in Phase 1C (admin shell) and beyond.
        </p>
      </div>

      {session?.organisations && session.organisations.length > 0 && (
        <div className="rounded border border-grey-200 bg-white p-6">
          <h2 className="font-medium">Your organisations</h2>
          <ul className="mt-4 space-y-2">
            {session.organisations.map((org) => (
              <li key={org.id} className="text-sm">
                <span className="font-medium">{org.name}</span>
                <span className="text-grey-500"> ({org.slug})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
