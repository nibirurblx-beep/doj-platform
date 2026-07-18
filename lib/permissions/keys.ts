/**
 * Permission keys.
 *
 * MUST mirror supabase/seed/0001_permissions.sql exactly.
 * `npm run check:permissions` verifies the two never drift and runs in CI
 * and in every phase's manual checklist.
 *
 * Never compare against role names anywhere in the application: all
 * authorisation decisions use these keys via user_has_permission /
 * my_permissions on the database.
 */
export const PERMISSIONS = {
  // Public content
  PUBLIC_CONTENT_VIEW: "public_content.view",
  NEWS_VIEW: "news.view",
  RESOURCES_PUBLIC_VIEW: "resources.public.view",
  LEADERSHIP_DIRECTORY_VIEW: "leadership_directory.view",

  // Applications
  APPLICATIONS_CREATE: "applications.create",
  APPLICATIONS_OWN_VIEW: "applications.own.view",
  APPLICATIONS_OWN_UPDATE: "applications.own.update",
  APPLICATIONS_ASSIGNED_VIEW: "applications.assigned.view",
  APPLICATIONS_DEPARTMENT_VIEW: "applications.department.view",
  APPLICATIONS_ALL_VIEW: "applications.all.view",
  APPLICATIONS_REVIEW: "applications.review",
  APPLICATIONS_STATUS_CHANGE: "applications.status.change",
  APPLICATIONS_ASSIGN: "applications.assign",
  APPLICATIONS_NOTES_INTERNAL: "applications.notes.internal",
  APPLICATIONS_BACKGROUND_CHECK_MANAGE: "applications.background_check.manage",
  APPLICATIONS_CHECKLIST_MANAGE: "applications.checklist.manage",
  APPLICATIONS_ARCHIVE: "applications.archive",

  // Employees
  EMPLOYEES_SELF_VIEW: "employees.self.view",
  EMPLOYEES_DIRECTORY_VIEW: "employees.directory.view",
  EMPLOYEES_DEPARTMENT_VIEW: "employees.department.view",
  EMPLOYEES_ALL_VIEW: "employees.all.view",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_UPDATE: "employees.update",
  EMPLOYEES_STATUS_MANAGE: "employees.status.manage",
  EMPLOYEES_RANK_MANAGE: "employees.rank.manage",
  EMPLOYEES_ROLES_MANAGE: "employees.roles.manage",
  EMPLOYEES_PROMOTION_VIEW: "employees.promotion.view",
  EMPLOYEES_PROMOTION_MANAGE: "employees.promotion.manage",

  // Documents
  DOCUMENTS_PUBLIC_VIEW: "documents.public.view",
  DOCUMENTS_INTERNAL_VIEW: "documents.internal.view",
  DOCUMENTS_RESTRICTED_VIEW: "documents.restricted.view",
  DOCUMENTS_CREATE: "documents.create",
  DOCUMENTS_UPDATE: "documents.update",
  DOCUMENTS_ARCHIVE: "documents.archive",
  DOCUMENT_CATEGORIES_MANAGE: "document_categories.manage",
  DRIVE_SYNC_MANAGE: "drive_sync.manage",

  // Content
  CONTENT_CREATE: "content.create",
  CONTENT_EDIT: "content.edit",
  CONTENT_SUBMIT: "content.submit",
  CONTENT_PUBLISH: "content.publish",
  CONTENT_ARCHIVE: "content.archive",
  CONTENT_CATEGORIES_MANAGE: "content.categories.manage",

  // Vacancies (added in migration 0009)
  VACANCIES_MANAGE: "vacancies.manage",
  VACANCIES_PUBLISH: "vacancies.publish",

  // Administration
  USERS_INVITE: "users.invite",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  PERMISSIONS_MANAGE: "permissions.manage",
  ORGANISATIONS_MANAGE: "organisations.manage",
  AUDIT_LOGS_VIEW: "audit_logs.view",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionScope = "own" | "assigned" | "department" | "all";

/** One row of the caller's effective permission set (public.my_permissions). */
export interface EffectivePermission {
  organisation_id: string;
  permission_key: PermissionKey;
  scope: PermissionScope;
}
