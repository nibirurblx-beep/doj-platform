import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { ReadingRoomShell, formatDate } from "../shared";

export const metadata: Metadata = { title: "Press Releases" };
export const revalidate = 300;

export default async function PressReleasesPage() {
  const service = createSupabaseServiceClient();
  const { data: posts } = await service
    .from("content_posts")
    .select("id, title, slug, excerpt, published_at")
    .eq("type", "press_release")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  // Group by year, DOJ-style
  const byYear = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    const year = post.published_at
      ? String(new Date(post.published_at).getFullYear())
      : "Undated";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(post);
  }

  return (
    <ReadingRoomShell title="Press Releases" active="/reading-room/press-releases">
      <p className="text-sm leading-relaxed text-grey-700">
        Official statements issued by the Office of Public Affairs on behalf
        of the Department of Justice.
      </p>

      {(posts ?? []).length === 0 ? (
        <p className="mt-8 rounded border border-grey-200 bg-white p-6 text-sm text-grey-600">
          No press releases published yet.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {Array.from(byYear.entries()).map(([year, items]) => (
            <section key={year}>
              <h2 className="border-b-2 border-gold-500 pb-1 font-display text-lg text-navy-900">
                {year}
              </h2>
              <ul className="divide-y divide-grey-200">
                {items.map((post) => (
                  <li key={post.id} className="py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-gold-700">
                      Press Release
                      {post.published_at && (
                        <span className="ml-2 font-normal normal-case tracking-normal text-grey-500">
                          {formatDate(post.published_at)}
                        </span>
                      )}
                    </p>
                    <Link
                      href={`/reading-room/press-releases/${post.slug}`}
                      className="mt-1 block font-display text-lg leading-snug text-navy-900 hover:underline"
                    >
                      {post.title}
                    </Link>
                    {post.excerpt && (
                      <p className="mt-1 text-sm text-grey-700">{post.excerpt}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ReadingRoomShell>
  );
}
