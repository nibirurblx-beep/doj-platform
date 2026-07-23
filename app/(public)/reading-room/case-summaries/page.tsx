import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { ReadingRoomShell, formatDate } from "../shared";

export const metadata: Metadata = { title: "Case Summaries" };
export const revalidate = 300;

export default async function CaseSummariesPage() {
  const service = createSupabaseServiceClient();
  const { data: posts } = await service
    .from("content_posts")
    .select("id, title, slug, excerpt, published_at")
    .eq("type", "case_summary")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <ReadingRoomShell title="Case Summaries" active="/reading-room/case-summaries">
      {(posts ?? []).length === 0 ? (
        <p className="text-sm text-grey-600">No case summaries published yet.</p>
      ) : (
        <ul className="divide-y divide-grey-200">
          {(posts ?? []).map((post) => (
            <li key={post.id} className="py-4">
              <Link
                href={`/reading-room/case-summaries/${post.slug}`}
                className="font-medium text-navy-900 hover:underline"
              >
                {post.title}
              </Link>
              {post.published_at && (
                <p className="mt-0.5 text-xs text-grey-500">
                  {formatDate(post.published_at)}
                </p>
              )}
              {post.excerpt && (
                <p className="mt-1 text-sm text-grey-700">{post.excerpt}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </ReadingRoomShell>
  );
}
