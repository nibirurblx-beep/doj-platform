import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "News" };
export const revalidate = 300;

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsListPage() {
  const service = createSupabaseServiceClient();
  const { data: posts } = await service
    .from("content_posts")
    .select("slug, title, excerpt, published_at, cover_image_url")
    .eq("type", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl">News</h1>
      <p className="mt-2 text-grey-600">
        Announcements and updates from the Department of Justice.
      </p>

      {!posts || posts.length === 0 ? (
        <p className="mt-10 text-grey-500">No news published yet.</p>
      ) : (
        <div className="mt-10 space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="flex gap-5 border-b border-grey-200 pb-8">
              {post.cover_image_url && (
                <Link href={`/news/${post.slug}`} className="hidden shrink-0 sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="h-28 w-44 rounded object-cover"
                  />
                </Link>
              )}
              <div>
              <p className="text-xs uppercase tracking-wide text-grey-500">
                {formatDate(post.published_at)}
              </p>
              <h2 className="mt-1 font-display text-xl">
                <Link
                  href={`/news/${post.slug}`}
                  className="hover:underline"
                >
                  {post.title}
                </Link>
              </h2>
              {post.excerpt && (
                <p className="mt-2 text-grey-600">{post.excerpt}</p>
              )}
              <Link
                href={`/news/${post.slug}`}
                className="mt-3 inline-block text-sm text-navy-900 underline"
              >
                Read more
              </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
