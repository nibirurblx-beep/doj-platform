import { getUserSession } from "@/lib/auth/session";
import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";

export default async function PortalPage() {
  const session = await getUserSession();
  const permissions = await getMyPermissions();
  const has = (key: string) => permissions.some((p) => p.permission_key === key);

  const isLeadership =
    has(PERMISSIONS.USERS_INVITE) ||
    has(PERMISSIONS.USERS_MANAGE) ||
    has(PERMISSIONS.APPLICATIONS_ALL_VIEW) ||
    has(PERMISSIONS.APPLICATIONS_DEPARTMENT_VIEW);

  // Overview stats: leadership and global admins only
  let stats: Array<{ label: string; value: number }> = [];
  if (isLeadership) {
    const service = createSupabaseServiceClient();
    const nowIso = new Date().toISOString();
    const [pendingInv, openVacancies, submittedApps, activeEmployees] =
      await Promise.all([
        service
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", nowIso),
        service
          .from("vacancies")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        service
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "under_review"]),
        service
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
    stats = [
      { label: "Applications awaiting review", value: submittedApps.count ?? 0 },
      { label: "Open vacancies", value: openVacancies.count ?? 0 },
      { label: "Active employees", value: activeEmployees.count ?? 0 },
      { label: "Pending invitations", value: pendingInv.count ?? 0 },
    ];
  }

  // Quick access: only sections the user can actually open
  const quickLinks = [
    has(PERMISSIONS.CONTENT_CREATE) || has(PERMISSIONS.CONTENT_EDIT)
      ? { href: "/portal/content", label: "Manage content" }
      : null,
    has(PERMISSIONS.APPLICATIONS_ALL_VIEW) ||
    has(PERMISSIONS.APPLICATIONS_DEPARTMENT_VIEW)
      ? { href: "/portal/employment/applications", label: "Review applications" }
      : null,
    has(PERMISSIONS.VACANCIES_MANAGE)
      ? { href: "/portal/employment/vacancies", label: "Manage vacancies" }
      : null,
    { href: "/portal/documents", label: "Documents" },
    has(PERMISSIONS.USERS_INVITE)
      ? { href: "/portal/admin/invitations", label: "Invite staff" }
      : null,
    has(PERMISSIONS.USERS_MANAGE)
      ? { href: "/portal/admin/users", label: "Manage users" }
      : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">
          Welcome{session?.user.displayName ? `, ${session.user.displayName}` : ""}
        </h1>
      </div>

      {isLeadership && stats.length > 0 && (
        <div>
          <h2 className="font-medium">Overview</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((card) => (
              <div
                key={card.label}
                className="rounded border border-grey-200 bg-white p-5"
              >
                <p className="text-sm text-grey-600">{card.label}</p>
                <p className="mt-1 font-display text-3xl">{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border border-grey-200 bg-white p-5">
        <h2 className="font-medium">Quick access</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded bg-navy-900 px-4 py-2 text-sm text-white shadow-sm hover:-translate-y-0.5 hover:bg-navy-800 hover:shadow"
            >
              {link.label}
            </Link>
          ))}
        </div>
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
