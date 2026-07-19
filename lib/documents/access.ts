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
 * 1. "employees/..." — HR files (NDAs, contracts). Hidden from the general
 *    documents browser; reachable only via employee profiles by holders of
 *    employee-view permissions for that organisation.
 *
 * 2. Folder privacy is a SETTING stored in document_folder_rules: a rule on
 *    a folder makes it (and everything inside) private to one organisation.
 *    Folder names are free. Rules on nested folders stack: every rule on
 *    the path must pass (most restrictive wins).
 *
 * 3. No rule = visible to all staff with documents.internal.view.
 */

export const EMPLOYEE_FILES_ROOT = "employees";

export interface FolderRule {
  path: string;
  organisationId: string;
  organisationName: string;
}

export interface DocAccess {
  /** Can the user see/download this exact path? */
  canAccess: (path: string) => boolean;
  /** Rule lookup for badges/controls, keyed by folder path. */
  ruleByPath: Map<string, FolderRule>;
  /** Organisations the user may make folders private to. */
  assignableOrgs: Array<{ id: string; name: string }>;
  isAllScope: boolean;
}

/** True when `prefix` is the same folder as, or an ancestor of, `path`. */
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
    { data: orgRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getPermittedOrgIds(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
    hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW),
    hasPermissionAnywhere(PERMISSIONS.EMPLOYEES_ALL_VIEW),
    getPermittedOrgIds(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW),
    service.from("document_folder_rules").select("path, organisation_id"),
    service.from("organisations").select("id, name, slug"),
  ]);

  const orgNameById = new Map((orgRows ?? []).map((o) => [o.id, o.name] as const));

  // The user's memberships (which orgs' private folders they can enter)
  let myOrgIds = new Set<string>();
  if (user) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("organisation_id")
      .eq("user_id", user.id);
    myOrgIds = new Set((memberships ?? []).map((m) => m.organisation_id));
  }

  const isAllScope = docScope.all;

  const ruleByPath = new Map<string, FolderRule>();
  for (const row of ruleRows ?? []) {
    ruleByPath.set(row.path, {
      path: row.path,
      organisationId: row.organisation_id,
      organisationName: orgNameById.get(row.organisation_id) ?? "Unknown",
    });
  }

  // Employee-file access: org ids where the user holds employee view rights
  const empOrgIds = empAll || empDeptScope.all
    ? new Set((orgRows ?? []).map((o) => o.id))
    : new Set(empDeptScope.orgIds);
  const orgSlugToId = new Map((orgRows ?? []).map((o) => [o.slug.toLowerCase(), o.id] as const));

  const canAccess = (path: string): boolean => {
    const top = path.split("/")[0]?.toLowerCase() ?? "";

    if (top === EMPLOYEE_FILES_ROOT) {
      // employees/<org_slug>/<employee_number>/...
      const slug = path.split("/")[1]?.toLowerCase() ?? "";
      const orgId = orgSlugToId.get(slug);
      return Boolean(orgId && empOrgIds.has(orgId));
    }
    if (!canDocs) return false;
    if (isAllScope) return true;

    // Every rule on the ancestor chain must pass
    for (const rule of ruleByPath.values()) {
      if (isPathWithin(path, rule.path) && !myOrgIds.has(rule.organisationId)) {
        return false;
      }
    }
    return true;
  };

  const assignableOrgs = (orgRows ?? [])
    .filter((o) => isAllScope || myOrgIds.has(o.id))
    .map((o) => ({ id: o.id, name: o.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { canAccess, ruleByPath, assignableOrgs, isAllScope };
}
