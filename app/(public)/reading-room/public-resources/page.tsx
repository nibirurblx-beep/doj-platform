import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { ReadingRoomShell } from "../shared";

export const metadata: Metadata = {
  title: "Public Resources",
  description:
    "Downloadable legal templates and resources for those practicing law.",
};
export const revalidate = 300;

const RESOURCES_PREFIX = "resources";
const BUCKET = "public-media";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default async function PublicResourcesPage() {
  const service = createSupabaseServiceClient();
  const { data: entries } = await service.storage
    .from(BUCKET)
    .list(RESOURCES_PREFIX, { limit: 200, sortBy: { column: "name", order: "asc" } });

  const all = (entries ?? []).filter((e) => e.id !== null);
  const files = all.filter((e) => !e.name.endsWith(".link"));

  // Resolve link entries to their target URLs
  const linkEntries = all.filter((e) => e.name.endsWith(".link"));
  const links: Array<{ name: string; url: string }> = [];
  for (const entry of linkEntries) {
    const { data: blob } = await service.storage
      .from(BUCKET)
      .download(`${RESOURCES_PREFIX}/${entry.name}`);
    if (!blob) continue;
    try {
      const parsed = JSON.parse(await blob.text()) as { url?: string };
      if (parsed.url) {
        links.push({ name: entry.name.replace(/\.link$/, ""), url: parsed.url });
      }
    } catch {
      // malformed link file - skip
    }
  }

  return (
    <ReadingRoomShell title="Public Resources" active="/reading-room/public-resources">
      <p className="leading-relaxed text-grey-800">
        Templates and reference material published by the department for
        those practicing law privately: motions, criminal complaints and
        other filings. Download, complete and file - no account required.
      </p>

      {files.length === 0 && links.length === 0 ? (
        <p className="mt-8 rounded border border-grey-200 bg-white p-6 text-sm text-grey-600">
          No resources have been published yet - check back soon.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-grey-200 rounded border border-grey-200 bg-white">
          {links.map((link) => (
            <li
              key={`link-${link.name}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-900">
                  🔗 {link.name}
                </p>
                <p className="truncate text-xs text-grey-500">{link.url}</p>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-grey-300 px-3.5 py-1.5 text-sm hover:border-navy-900"
              >
                Open
              </a>
            </li>
          ))}
          {files.map((file) => {
            const { data: pub } = service.storage
              .from(BUCKET)
              .getPublicUrl(`${RESOURCES_PREFIX}/${file.name}`);
            return (
              <li
                key={file.name}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy-900">
                    📄 {file.name}
                  </p>
                  <p className="text-xs text-grey-500">
                    {formatSize(
                      (file.metadata as { size?: number } | null)?.size ?? 0,
                    )}
                  </p>
                </div>
                <a
                  href={pub.publicUrl}
                  download
                  className="rounded bg-navy-900 px-3.5 py-1.5 text-sm text-white hover:bg-navy-800"
                >
                  Download
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs text-grey-500">
        These templates are provided for the community&rsquo;s roleplay and
        do not constitute real legal advice.
      </p>
    </ReadingRoomShell>
  );
}
