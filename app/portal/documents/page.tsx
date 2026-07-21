import { requireActiveUser } from "@/lib/auth/session";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";
import {
  DOCUMENTS_BUCKET,
  FOLDER_PLACEHOLDER,
  LINK_EXTENSION,
  isSafePath,
  formatSize,
} from "@/lib/documents/storage";
import { getDocAccess, EMPLOYEE_FILES_ROOT } from "@/lib/documents/access";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UploadForm, NewFolderForm, DeleteButton, DeleteFolderButton, FolderVisibilityControl, AddResourceForm } from "./toolbar";

export const metadata = { title: "Documents" };

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await requireActiveUser();
  if (!(await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW))) {
    redirect("/portal?denied=Documents");
  }

  const [canUpload, canDelete] = await Promise.all([
    hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_CREATE),
    hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_ARCHIVE),
  ]);

  const params = await searchParams;
  const folder =
    typeof params.folder === "string" && isSafePath(params.folder)
      ? params.folder
      : "";

  const access = await getDocAccess();
  if (folder && !access.canAccess(`${folder}/x`)) {
    redirect("/portal/documents");
  }

  const service = createSupabaseServiceClient();
  const { data: entries, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .list(folder || undefined, {
      limit: 500,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-lg text-red-900">
          Could not load documents
        </h2>
        <p className="mt-2 text-sm text-red-900">{error.message}</p>
        <p className="mt-2 text-sm text-red-900">
          If this is a new install, run migration 0013_documents_storage.sql
          to create the storage bucket.
        </p>
      </div>
    );
  }

  // Storage list returns folders as entries without metadata/id
  const folders = (entries ?? [])
    .filter((e) => !e.id)
    .filter((e) => {
      const path = folder ? `${folder}/${e.name}` : e.name;
      if (folder === "" && e.name.toLowerCase() === EMPLOYEE_FILES_ROOT) {
        return false; // managed via employee profiles
      }
      return access.canAccess(`${path}/x`);
    });
  const allFiles = (entries ?? []).filter(
    (e) => e.id && e.name !== FOLDER_PLACEHOLDER,
  );
  const files = allFiles.filter((e) => !e.name.endsWith(LINK_EXTENSION));
  const linkEntries = allFiles.filter((e) => e.name.endsWith(LINK_EXTENSION));

  // Resolve link targets (small JSON files; capped for safety)
  const links = await Promise.all(
    linkEntries.slice(0, 50).map(async (entry) => {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      try {
        const { data } = await service.storage
          .from(DOCUMENTS_BUCKET)
          .download(path);
        const parsed = JSON.parse((await data?.text()) ?? "{}") as {
          url?: string;
        };
        return {
          name: entry.name.slice(0, -LINK_EXTENSION.length),
          path,
          url: typeof parsed.url === "string" ? parsed.url : null,
        };
      } catch {
        return { name: entry.name.slice(0, -LINK_EXTENSION.length), path, url: null };
      }
    }),
  );

  const crumbs = folder ? folder.split("/") : [];
  const parentFolder = crumbs.slice(0, -1).join("/");

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Link href="/portal/documents" className="text-navy-900 underline">
          Documents
        </Link>
        {crumbs.map((crumb, i) => {
          const path = crumbs.slice(0, i + 1).join("/");
          const isLast = i === crumbs.length - 1;
          return (
            <span key={path} className="flex items-center gap-1">
              <span className="text-grey-400">/</span>
              {isLast ? (
                <span className="font-medium">{crumb}</span>
              ) : (
                <Link
                  href={`/portal/documents?folder=${encodeURIComponent(path)}`}
                  className="text-navy-900 underline"
                >
                  {crumb}
                </Link>
              )}
            </span>
          );
        })}
      </div>

      {/* Toolbar */}
      {canUpload && (
        <div className="flex flex-wrap items-center gap-6 rounded border border-grey-200 bg-grey-050 p-3">
          <UploadForm folder={folder} />
          <NewFolderForm folder={folder} />
          <AddResourceForm folder={folder} />
        </div>
      )}

      {/* Listing */}
      <div className="overflow-x-auto rounded border border-grey-200 bg-white">
        {folders.length === 0 && files.length === 0 && links.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            This folder is empty.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                {canDelete && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {folder && (
                <tr className="border-b border-grey-100">
                  <td className="px-5 py-3" colSpan={canDelete ? 4 : 3}>
                    <Link
                      href={
                        parentFolder
                          ? `/portal/documents?folder=${encodeURIComponent(parentFolder)}`
                          : "/portal/documents"
                      }
                      className="text-navy-900 hover:underline"
                    >
                      ← Up
                    </Link>
                  </td>
                </tr>
              )}
              {folders.map((entry) => {
                const path = folder ? `${folder}/${entry.name}` : entry.name;
                return (
                  <tr key={path} className="border-b border-grey-100 hover:bg-grey-050">
                    <td className="px-5 py-3">
                      <Link
                        href={`/portal/documents?folder=${encodeURIComponent(path)}`}
                        className="font-medium text-navy-900 hover:underline"
                      >
                        📁 {entry.name}
                      </Link>
                      {access.ruleByPath.has(path) && (
                        <span className="ml-2 rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-200">
                          Private to {access.ruleByPath.get(path)!.organisationName}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-grey-600">—</td>
                    <td className="px-5 py-3 text-grey-600">
                      {canUpload && (
                        <FolderVisibilityControl
                          path={path}
                          currentOrgId={access.ruleByPath.get(path)?.organisationId ?? null}
                          organisations={access.assignableOrgs}
                        />
                      )}
                    </td>
                    {canDelete && (
                      <td className="px-5 py-3 text-right">
                        <DeleteFolderButton path={path} />
                      </td>
                    )}
                  </tr>
                );
              })}
              {links.map((link) => (
                <tr key={link.path} className="border-b border-grey-100 hover:bg-grey-050">
                  <td className="px-5 py-3">
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-navy-900 hover:underline"
                      >
                        🔗 {link.name}
                        <span className="ml-1.5 text-xs text-grey-500">↗</span>
                      </a>
                    ) : (
                      <span className="text-grey-500">🔗 {link.name} (broken)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-grey-600">Link</td>
                  <td className="px-5 py-3 text-grey-600">—</td>
                  {canDelete && (
                    <td className="px-5 py-3 text-right">
                      <DeleteButton path={link.path} />
                    </td>
                  )}
                </tr>
              ))}
              {files.map((entry) => {
                const path = folder ? `${folder}/${entry.name}` : entry.name;
                const meta = entry.metadata as {
                  size?: number;
                } | null;
                return (
                  <tr key={path} className="border-b border-grey-100 hover:bg-grey-050">
                    <td className="px-5 py-3">
                      <a
                        href={`/portal/documents/download?path=${encodeURIComponent(path)}`}
                        className="text-navy-900 hover:underline"
                      >
                        {entry.name}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-grey-600">
                      {formatSize(meta?.size ?? null)}
                    </td>
                    <td className="px-5 py-3 text-grey-600">
                      {formatDate(entry.updated_at)}
                    </td>
                    {canDelete && (
                      <td className="px-5 py-3 text-right">
                        <DeleteButton path={path} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-grey-500">
        Stored privately in Supabase Storage. 20 MB per file. Use the
        dropdown on any folder to make it private to a department or open it
        to all staff — privacy covers everything inside the folder.
        {canUpload ? "" : " Ask an administrator to add or remove files."}
      </p>
    </div>
  );
}
