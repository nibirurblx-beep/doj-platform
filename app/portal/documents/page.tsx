import { requireActiveUser } from "@/lib/auth/session";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import {
  isDriveConfigured,
  getDriveRootFolderId,
  listFolder,
  getItem,
  isWithinRoot,
} from "@/lib/google/drive";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Documents" };

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fileKindLabel(mimeType: string): string {
  if (mimeType.includes("google-apps.document")) return "Google Doc";
  if (mimeType.includes("google-apps.spreadsheet")) return "Google Sheet";
  if (mimeType.includes("google-apps.presentation")) return "Google Slides";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image/")) return "Image";
  if (mimeType.includes("wordprocessingml")) return "Word";
  if (mimeType.includes("spreadsheetml")) return "Excel";
  return "File";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  await requireActiveUser();
  if (!(await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW))) {
    redirect("/portal");
  }

  if (!isDriveConfigured()) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-display text-lg text-amber-900">
          Document repository not configured
        </h2>
        <p className="mt-2 text-sm text-amber-900">
          Google Drive credentials are missing. Follow{" "}
          <code className="rounded bg-amber-100 px-1">
            docs/setup-google-drive.md
          </code>{" "}
          to create a service account, share the repository folder with it,
          and add the three environment variables. Then restart the server.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const rootId = getDriveRootFolderId();
  const folderId = params.folder ?? rootId;

  // Never allow browsing outside the repository root
  if (folderId !== rootId && !(await isWithinRoot(folderId))) {
    redirect("/portal/documents");
  }

  let items;
  let folderName = "Documents";
  let parentLink: string | null = null;

  try {
    items = await listFolder(folderId);
    if (folderId !== rootId) {
      const folder = await getItem(folderId);
      folderName = folder.name;
      const parent = folder.parents[0];
      parentLink =
        parent && parent !== rootId
          ? `/portal/documents?folder=${parent}`
          : "/portal/documents";
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Drive error";
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6">
        <h2 className="font-display text-lg text-red-900">
          Could not reach Google Drive
        </h2>
        <p className="mt-2 text-sm text-red-900">{message}</p>
        <p className="mt-2 text-sm text-red-900">
          Check the service account has access to the repository folder and
          that the Drive API is enabled for the project.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {parentLink && (
          <Link
            href={parentLink}
            className="rounded border border-grey-300 bg-white px-2.5 py-1 text-sm hover:border-navy-900"
          >
            ← Up
          </Link>
        )}
        <h2 className="font-display text-xl">{folderName}</h2>
      </div>

      <div className="rounded border border-grey-200 bg-white">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            This folder is empty.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Kind</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Modified</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-grey-100 hover:bg-grey-050">
                  <td className="px-5 py-3">
                    {item.isFolder ? (
                      <Link
                        href={`/portal/documents?folder=${item.id}`}
                        className="font-medium text-navy-900 hover:underline"
                      >
                        📁 {item.name}
                      </Link>
                    ) : (
                      <a
                        href={`/portal/documents/download/${item.id}`}
                        className="text-navy-900 hover:underline"
                      >
                        {item.name}
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-grey-600">
                    {item.isFolder ? "Folder" : fileKindLabel(item.mimeType)}
                  </td>
                  <td className="px-5 py-3 text-grey-600">
                    {item.isFolder ? "—" : formatSize(item.size)}
                  </td>
                  <td className="px-5 py-3 text-grey-600">
                    {formatDate(item.modifiedTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-grey-500">
        Files are stored in Google Drive and served through the portal.
        Google-native documents download as PDF.
      </p>
    </div>
  );
}
