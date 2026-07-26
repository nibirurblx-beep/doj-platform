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
    .limit(100);

  return (
    <ReadingRoomShell title="Case Summaries" active="/reading-room/case-summaries">
      <p className="text-sm leading-relaxed text-grey-700">
        Public summaries of concluded cases and proceedings, published once a
        matter has closed.
      </p>

      {(posts ?? []).length === 0 ? (
        <p className="mt-8 rounded border border-grey-200 bg-white p-6 text-sm text-grey-600">
          No case summaries published yet.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {(posts ?? []).map((post) => (
            <Link
              key={post.id}
              href={`/reading-room/case-summaries/${post.slug}`}
              className="block rounded border border-grey-200 border-l-4 border-l-navy-900 bg-white p-5 transition hover:border-l-gold-500 hover:shadow"
            >
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-grey-500">
                <span className="rounded bg-navy-900 px-1.5 py-0.5 text-gold-200">
                  Closed
                </span>
                Case Summary
                {post.published_at && (
                  <span className="font-normal normal-case tracking-normal">
                    · {formatDate(post.published_at)}
                  </span>
                )}
              </p>
              <h2 className="mt-2 font-display text-lg leading-snug text-navy-900">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mt-1 text-sm text-grey-700">{post.excerpt}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </ReadingRoomShell>
  );
}
