import { requireActiveUser } from "@/lib/auth/session";
import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import Link from "next/link";
import { PortalNav } from "@/components/portal/nav";
import { UserMenu } from "@/components/portal/user-menu";
import { Seal } from "@/components/brand/seal";

export const metadata = { title: "Portal" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireActiveUser();
  const myPermissions = await getMyPermissions();
  const adminKeys: string[] = [
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.CONTENT_PUBLISH,
  ];
  const showAdmin = myPermissions.some((p) =>
    adminKeys.includes(p.permission_key),
  );

  return (
    <div className="flex min-h-screen bg-grey-050">
      {/* Sidebar navigation */}
      <aside className="hidden w-64 border-r border-grey-200 bg-white md:block">
        <div className="sticky top-0 space-y-6 p-6">
          <Link href="/portal" className="flex items-center gap-3">
            <Seal size={36} />
            <p className="font-display text-lg">DOJ</p>
          </Link>
          <PortalNav showAdmin={showAdmin} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="border-b border-grey-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="font-display text-xl">Portal</h1>
            <UserMenu user={session.user} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
