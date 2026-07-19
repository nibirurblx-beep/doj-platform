import { getMyPermissions } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";

export const metadata = { title: "Content" };

const CONTENT_PERMISSIONS: string[] = [
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_EDIT,
  PERMISSIONS.CONTENT_PUBLISH,
];

export default async function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const permissions = await getMyPermissions();
  const allowed = permissions.some((p) =>
    CONTENT_PERMISSIONS.includes(p.permission_key),
  );
  if (!allowed) redirect("/portal");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Content</h1>
      {children}
    </div>
  );
}
