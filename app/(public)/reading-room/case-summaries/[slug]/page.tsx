import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/db/server";

export const revalidate = 300;

const POST_TYPE = "case_summary";
const LIST_HREF = "/reading-room/case-summaries";
const LIST_LABEL = "All case summaries";

function hrefFor(slug: string) {
  return `${LIST_HREF}/${slug}`;
}

async function getPost(slug: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("content_posts")
    .select("id, title, excerpt, body_html, published_at, cover_image_url, author_id")
    .eq("type", POST_TYPE)
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function CaseSummaryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // Author card: name + their other published articles
  const service = createSupabaseServiceClient();
  const [{ data: author }, { data: otherPosts }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name")
      .eq("id", post.author_id)
      .single(),
    service
      .from("content_posts")
      .select("title, slug, published_at")
      .eq("type", POST_TYPE)
      .eq("status", "published")
      .eq("author_id", post.author_id)
      .neq("id", post.id)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);
  const authorName = author?.display_name || "Department of Justice";

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
        <article className="min-w-0">
          <Link href={LIST_HREF} className="text-sm text-navy-900 underline">
            ← {LIST_LABEL}
          </Link>
          <p className="mt-6 text-xs uppercase tracking-wide text-grey-500">
            {formatDate(post.published_at)}
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight">
            {post.title}
          </h1>
          {post.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_image_url}
              alt=""
              className="mt-6 aspect-video w-full rounded object-cover"
            />
          )}
          {/* body_html is sanitised server-side at save time (see content actions) */}
          <div
            className="prose mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />
        </article>

        {/* Author card - follows the scroll */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded border border-grey-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 font-display text-lg text-white">
                {authorName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-grey-500">
                  Published by
                </p>
                <p className="truncate text-sm font-medium text-navy-900">
                  {authorName}
                </p>
              </div>
            </div>
            {(otherPosts ?? []).length > 0 && (
              <>
                <h2 className="mt-5 border-t border-grey-100 pt-4 text-xs font-medium uppercase tracking-wide text-grey-500">
                  More from {authorName}
                </h2>
                <ul className="mt-2 space-y-2.5">
                  {(otherPosts ?? []).map((other) => (
                    <li key={other.slug}>
                      <Link
                        href={hrefFor(other.slug)}
                        className="block text-sm leading-snug text-navy-900 hover:underline"
                      >
                        {other.title}
                      </Link>
                      <p className="text-xs text-grey-500">
                        {formatDate(other.published_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
