import "server-only";
import {
  getMyOrgSlugs,
  getPermittedOrgIds,
  hasPermissionAnywhere,
} from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";

/**
 * Document path access rules:
 *
 * 1. "employees/..." — HR files (NDAs, contracts). Hidden from the general
 *    documents browser entirely; accessible only via employee profiles by
 *    holders of employee-view permissions, department-scoped by the org
 *    slug in the path: employees/<org_slug>/<employee_number>/file.pdf
 *
 * 2. A top-level folder whose name matches an organisation slug (e.g.
 *    "doj", "mpd", "fbi") is PRIVATE TO THAT DEPARTMENT: visible only to
 *    its members, or to anyone whose documents permission has "all" scope
 *    (Platform Administrator).
 *
 * 3. Everything else is staff-wide (requires documents.internal.view).
 */

let orgSlugCache: { slugs: string[]; at: number } | null = null;

export async function getAllOrgSlugs(): Promise<string[]> {
  if (orgSlugCache && Date.now() - orgSlugCache.at < 60_000) {
    return orgSlugCache.slugs;
  }
  const service = createSupabaseServiceClient();
  const { data } = await service.from("organisations").select("slug");
  const slugs = (data ?? []).map((o) => o.slug.toLowerCase());
  orgSlugCache = { slugs, at: Date.now() };
  return slugs;
}

export const EMPLOYEE_FILES_ROOT = "employees";

export interface DocAccess {
  /** Can the user see/download this exact path? */
  canAccess: (path: string) => boolean;
  /** Org slugs whose department folders the user may see. */
  visibleOrgSlugs: string[];
  /** All org slugs (to know which top-level folders are departmental). */
  allOrgSlugs: string[];
  isAllScope: boolean;
}

export async function getDocAccess(): Promise<DocAccess> {
  const [allOrgSlugs, myOrgSlugs, docScope, canDocs, empAll, empDeptScope] =
    await Promise.all([
      getAllOrgSlugs(),
      getMyOrgSlugs(),
      getPermittedOrgIds(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
      hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
      hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_ALL_VIEW),
      getPermittedOrgIds(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW),
    ]);

  const isAllScope = docScope.all;
  const mySlugSet = new Set(myOrgSlugs.map((s) => s.toLowerCase()));
  const visibleOrgSlugs = isAllScope
    ? allOrgSlugs
    : allOrgSlugs.filter((slug) => mySlugSet.has(slug));

  // Employee files: org slugs where the user holds employee view rights
  const empService = createSupabaseServiceClient();
  let empSlugs: string[] = [];
  if (empAll || empDeptScope.all) {
    empSlugs = allOrgSlugs;
  } else if (empDeptScope.orgIds.length > 0) {
    const { data } = await empService
      .from("organisations")
      .select("slug")
      .in("id", empDeptScope.orgIds);
    empSlugs = (data ?? []).map((o) => o.slug.toLowerCase());
  }
  const empSlugSet = new Set(empSlugs);

  const canAccess = (path: string): boolean => {
    const top = path.split("/")[0]?.toLowerCase() ?? "";

    if (top === EMPLOYEE_FILES_ROOT) {
      // employees/<org_slug>/<employee_number>/...
      const orgSlug = path.split("/")[1]?.toLowerCase() ?? "";
      return empSlugSet.has(orgSlug);
    }
    if (!canDocs) return false;
    if (allOrgSlugs.includes(top)) {
      return isAllScope || mySlugSet.has(top);
    }
    return true;
  };

  return { canAccess, visibleOrgSlugs, allOrgSlugs, isAllScope };
}
