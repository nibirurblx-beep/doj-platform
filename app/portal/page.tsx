import { getUserSession } from "@/lib/auth/session";
import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  const denied =
    typeof params.denied === "string" && params.denied.length <= 40
      ? params.denied
      : null;
  const session = await getUserSession();
  const permissions = await getMyPermissions();

  // Documents assigned to this user for signature
  const serviceForSignatures = createSupabaseServiceClient();
  const { data: mySignatures } = session
    ? await serviceForSignatures
        .from("signature_requests")
        .select("id, title, requested_at, user_id, requested_by, status, organisations(name)")
        .or(
          `and(user_id.eq.${session.user.id},status.eq.pending),and(requested_by.eq.${session.user.id},status.eq.pending_employer)`,
        )
        .order("requested_at")
    : { data: [] };
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
      {denied && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            You don&rsquo;t have access to {denied}.
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Your roles don&rsquo;t include that section. If you need it, ask a
            platform administrator to grant the right role.
          </p>
        </div>
      )}
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

      {(mySignatures ?? []).length > 0 && (
        <div className="rounded border border-gold-600 bg-white p-5">
          <h2 className="font-medium">Documents awaiting your signature</h2>
          <ul className="mt-3 space-y-2">
            {(mySignatures ?? []).map((req) => (
              <li key={req.id}>
                <Link
                  href={`/portal/sign/${req.id}`}
                  className="text-sm text-navy-900 underline-offset-2 hover:underline"
                >
                  ✍️ {req.title}
                  {req.status === "pending_employer" && (
                    <span className="ml-1.5 rounded bg-gold-600 px-1.5 py-0.5 text-[10px] font-medium text-navy-950">
                      Countersign
                    </span>
                  )}
                </Link>
                <span className="ml-2 text-xs text-grey-500">
                  {(req.organisations as unknown as { name: string } | null)?.name}
                </span>
              </li>
            ))}
          </ul>
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
