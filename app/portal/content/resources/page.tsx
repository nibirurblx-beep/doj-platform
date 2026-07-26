import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ResourceUploadForm, ResourceDeleteButton, ResourceLinkForm } from "./widgets";

export const metadata = { title: "Public resources" };

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default async function ResourcesAdminPage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.CONTENT_CREATE))) {
    redirect("/portal?denied=public resources");
  }

  const service = createSupabaseServiceClient();
  const { data: entries } = await service.storage
    .from("public-media")
    .list("resources", { limit: 200, sortBy: { column: "name", order: "asc" } });
  const files = (entries ?? []).filter((e) => e.id !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Public resources</h1>
        <p className="mt-1 text-sm text-grey-600">
          Legal templates published for public download in the{" "}
          <Link href="/reading-room/public-resources" className="underline">
            Reading Room
          </Link>
          . Uploading a file with the same name replaces it. PDF, Word, ODT,
          RTF or TXT, 10 MB max.
        </p>
      </div>

      <div className="space-y-3 rounded border border-grey-200 bg-white p-5">
        <ResourceUploadForm />
        <div className="border-t border-grey-100 pt-3">
          <ResourceLinkForm />
        </div>
      </div>

      {files.length === 0 ? (
        <p className="rounded border border-grey-200 bg-white p-5 text-sm text-grey-600">
          Nothing published yet.
        </p>
      ) : (
        <ul className="divide-y divide-grey-200 rounded border border-grey-200 bg-white">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {file.name.endsWith(".link") ? "🔗" : "📄"}{" "}
                  {file.name.replace(/\.link$/, "")}
                </p>
                <p className="text-xs text-grey-500">
                  {formatSize((file.metadata as { size?: number } | null)?.size ?? 0)}
                </p>
              </div>
              <ResourceDeleteButton name={file.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
