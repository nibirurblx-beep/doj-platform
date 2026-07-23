import { requireActiveUser, isStaffUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import Link from "next/link";
import { PortalNav } from "@/components/portal/nav";
import { MobilePortalNav } from "@/components/portal/mobile-nav";
import { UserMenu } from "@/components/portal/user-menu";
import { Seal } from "@/components/brand/seal";

export const metadata = { title: "Portal" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireActiveUser();

  // The portal is for staff (organisation members) only. Applicants are
  // sent to their own dashboard.
  if (!(await isStaffUser(session.user.id))) {
    redirect("/applicant");
  }

  const myPermissions = await getMyPermissions();
  const has = (key: string) =>
    myPermissions.some((p) => p.permission_key === key);

  const navItems = [
    { href: "/portal", label: "Dashboard", exact: true },
    has(PERMISSIONS.CONTENT_CREATE) ||
    has(PERMISSIONS.CONTENT_EDIT) ||
    has(PERMISSIONS.CONTENT_PUBLISH)
      ? { href: "/portal/content", label: "Content" }
      : null,
    has(PERMISSIONS.APPLICATIONS_ALL_VIEW) ||
    has(PERMISSIONS.APPLICATIONS_DEPARTMENT_VIEW) ||
    has(PERMISSIONS.VACANCIES_MANAGE) ||
    has(PERMISSIONS.EMPLOYEES_ALL_VIEW) ||
    has(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW)
      ? { href: "/portal/employment", label: "Employment register" }
      : null,
    { href: "/portal/documents", label: "Documents" },
    has(PERMISSIONS.EMPLOYEES_ALL_VIEW) || has(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW)
      ? { href: "/portal/foi", label: "FOI requests" }
      : null,
    has(PERMISSIONS.USERS_INVITE) || has(PERMISSIONS.USERS_MANAGE)
      ? { href: "/portal/admin", label: "Administration" }
      : null,
    { href: "/portal/guide", label: "Guide" },
    { href: "/portal/settings", label: "Settings" },
  ].filter((i): i is { href: string; label: string; exact?: boolean } => i !== null);

  return (
    <div className="flex min-h-screen bg-grey-050">
      {/* Sidebar navigation */}
      <aside className="hidden w-64 border-r border-grey-200 bg-white md:block">
        <div className="sticky top-0 space-y-6 p-6">
          <Link href="/portal" className="flex items-center gap-3">
            <Seal size={36} />
            <p className="font-display text-lg">DOJ</p>
          </Link>
          <PortalNav items={navItems} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="relative border-b border-grey-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center gap-3">
              <MobilePortalNav items={navItems} />
              <h1 className="font-display text-lg md:text-xl">Portal</h1>
            </div>
            <UserMenu user={session.user} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 portal-fade md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
