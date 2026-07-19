import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-grey-100 text-grey-700",
  review: "bg-amber-50 text-amber-800",
  published: "bg-green-50 text-green-700",
  archived: "bg-grey-100 text-grey-500",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ContentListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const filterType = params.type === "page" ? "page" : params.type === "news" ? "news" : null;

  const service = createSupabaseServiceClient();
  let query = service
    .from("content_posts")
    .select("id, type, slug, title, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filterType) query = query.eq("type", filterType);

  const { data: posts } = await query;

  const tabs = [
    { href: "/portal/content", label: "All", active: !filterType },
    { href: "/portal/content?type=news", label: "News", active: filterType === "news" },
    { href: "/portal/content?type=page", label: "Pages", active: filterType === "page" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded px-3 py-1.5 text-sm ${
                tab.active
                  ? "bg-navy-900 text-white"
                  : "text-grey-600 hover:bg-grey-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href="/portal/content/new?type=news"
            className="rounded bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-800"
          >
            New news post
          </Link>
          <Link
            href="/portal/content/new?type=page"
            className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900"
          >
            New page
          </Link>
        </div>
      </div>

      <div className="rounded border border-grey-200 bg-white">
        {!posts || posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-600">
            Nothing here yet. Create your first item above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 text-left text-grey-600">
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Published</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-grey-100 hover:bg-grey-050">
                  <td className="px-5 py-3">
                    <Link
                      href={`/portal/content/${post.id}`}
                      className="font-medium text-navy-900 hover:underline"
                    >
                      {post.title}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-grey-500">
                      /{post.slug}
                    </span>
                  </td>
                  <td className="px-5 py-3 capitalize">{post.type}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[post.status] ?? ""}`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">{formatDate(post.published_at)}</td>
                  <td className="px-5 py-3">{formatDate(post.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
