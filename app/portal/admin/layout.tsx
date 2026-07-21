import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { AdminNav } from "@/components/admin/admin-nav";
import { redirect } from "next/navigation";

const ADMIN_AREA_PERMISSIONS: string[] = [
  PERMISSIONS.USERS_INVITE,
  PERMISSIONS.USERS_MANAGE,
];

export const metadata = { title: "Administration" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole admin area. Individual actions re-check per permission.
  const permissions = await getMyPermissions();
  const allowed = permissions.some((p) =>
    ADMIN_AREA_PERMISSIONS.includes(p.permission_key),
  );
  if (!allowed) redirect("/portal?denied=Administration");

  return (
    <div className="space-y-6">
      <div className="border-b border-grey-200 pb-4">
        <h2 className="font-display text-xl">Administration</h2>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
