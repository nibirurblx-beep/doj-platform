import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import { redirect } from "next/navigation";

export interface MyPermission {
  organisation_id: string;
  permission_key: string;
  scope: string;
}

/**
 * All permissions for the signed-in user across every organisation,
 * fetched via the my_permissions() security definer function.
 */
export async function getMyPermissions(): Promise<MyPermission[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_permissions");
  if (error) {
    console.error("my_permissions failed:", error.message);
    return [];
  }
  return (data as MyPermission[]) ?? [];
}

/**
 * Does the signed-in user hold a permission in ANY organisation?
 * Used for navigation visibility. Server actions must still authorise
 * per-organisation with user_has_permission before mutating.
 */
export async function hasPermissionAnywhere(key: string): Promise<boolean> {
  const permissions = await getMyPermissions();
  return permissions.some((p) => p.permission_key === key);
}

/**
 * Gate a server component: redirect to the portal dashboard when the
 * user lacks the permission everywhere.
 */
export async function requirePermissionAnywhere(key: string): Promise<void> {
  if (!(await hasPermissionAnywhere(key))) {
    redirect("/portal");
  }
}

/**
 * Authorise a specific organisation-scoped action on the database.
 * ALWAYS call this inside server actions before privileged writes.
 */
export async function userHasPermission(
  permissionKey: string,
  organisationId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("user_has_permission", {
    p_user: user.id,
    p_permission: permissionKey,
    p_org: organisationId,
  });
  if (error) {
    console.error("user_has_permission failed:", error.message);
    return false;
  }
  return data === true;
}

export type OrgScope = { all: true } | { all: false; orgIds: string[] };

/**
 * Which organisations may the signed-in user exercise a permission in?
 * Scope "all" on any grant (e.g. Platform Administrator) means every
 * organisation; otherwise the exact organisation ids of the grants.
 * Use this to FILTER admin list pages so leadership only sees their
 * own department's records.
 */
export async function getPermittedOrgIds(
  permissionKey: string,
): Promise<OrgScope> {
  const permissions = await getMyPermissions();
  const grants = permissions.filter((p) => p.permission_key === permissionKey);
  if (grants.some((g) => g.scope === "all")) return { all: true };
  return { all: false, orgIds: [...new Set(grants.map((g) => g.organisation_id))] };
}

/** Organisation slugs the signed-in user is a member of. */
export async function getMyOrgSlugs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("memberships")
    .select("organisations(slug)")
    .eq("user_id", user.id);
  const slugs = (data ?? [])
    .map((m) => (m.organisations as unknown as { slug: string } | null)?.slug)
    .filter((s): s is string => Boolean(s));
  return slugs;
}
