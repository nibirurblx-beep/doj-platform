import "server-only";
import {
  getPermittedOrgIds,
  hasPermissionAnywhere,
} from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";

/**
 * Document access rules:
 *
 * 1. "employees/..." - HR files. Hidden from the general documents browser;
 *    reachable only via employee profiles by holders of employee-view
 *    permissions for that organisation.
 *
 * 2. Folder restriction is per-person: a restricted folder (row in
 *    document_folder_rules) is visible only to the users assigned to it in
 *    document_folder_members, plus all-scope holders (platform admins).
 *    Restrictions on nested folders stack: every restricted ancestor must
 *    include the user.
 *
 * 3. No rule = visible to all staff with documents.internal.view.
 */

export const EMPLOYEE_FILES_ROOT = "employees";

export interface FolderRule {
  path: string;
  memberCount: number;
  isMember: boolean;
}

export interface DocAccess {
  canAccess: (path: string) => boolean;
  /** Restricted folders, keyed by folder path (for badges/controls). */
  ruleByPath: Map<string, FolderRule>;
  isAllScope: boolean;
}

function isPathWithin(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export async function getDocAccess(): Promise<DocAccess> {
  const service = createSupabaseServiceClient();
  const supabase = await createSupabaseServerClient();

  const [
    { data: { user } },
    docScope,
    canDocs,
    empAll,
    empDeptScope,
    { data: ruleRows },
    { data: memberRows },
    { data: orgRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getPermittedOrgIds(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
    hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
    hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_ALL_VIEW),
    getPermittedOrgIds(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW),
    service.from("document_folder_rules").select("path"),
    service.from("document_folder_members").select("path, user_id"),
    service.from("organisations").select("id, slug"),
  ]);

  const isAllScope = docScope.all;
  const userId = user?.id ?? "";

  // Member counts + my membership per restricted folder
  const countByPath = new Map<string, number>();
  const myPaths = new Set<string>();
  for (const row of memberRows ?? []) {
    countByPath.set(row.path, (countByPath.get(row.path) ?? 0) + 1);
    if (row.user_id === userId) myPaths.add(row.path);
  }

  const ruleByPath = new Map<string, FolderRule>();
  for (const row of ruleRows ?? []) {
    ruleByPath.set(row.path, {
      path: row.path,
      memberCount: countByPath.get(row.path) ?? 0,
      isMember: myPaths.has(row.path),
    });
  }

  // Employee-file access: org ids where the user holds employee view rights
  const empOrgIds = empAll || empDeptScope.all
    ? new Set((orgRows ?? []).map((o) => o.id))
    : new Set(empDeptScope.orgIds);
  const orgSlugToId = new Map(
    (orgRows ?? []).map((o) => [o.slug.toLowerCase(), o.id] as const),
  );

  const canAccess = (path: string): boolean => {
    const top = path.split("/")[0]?.toLowerCase() ?? "";

    if (top === EMPLOYEE_FILES_ROOT) {
      const slug = path.split("/")[1]?.toLowerCase() ?? "";
      const orgId = orgSlugToId.get(slug);
      return Boolean(orgId && empOrgIds.has(orgId));
    }
    if (!canDocs) return false;
    if (isAllScope) return true;

    // Every restricted ancestor must include this user
    for (const rule of ruleByPath.values()) {
      if (isPathWithin(path, rule.path) && !rule.isMember) {
        return false;
      }
    }
    return true;
  };

  return { canAccess, ruleByPath, isAllScope };
}
