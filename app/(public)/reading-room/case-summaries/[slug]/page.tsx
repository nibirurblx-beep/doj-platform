import { createSupabaseServiceClient } from "@/lib/db/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300;

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function getPost(slug: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("content_posts")
    .select("title, excerpt, body_html, published_at")
    .eq("type", "case_summary")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
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

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/reading-room/case-summaries" className="text-sm text-navy-900 underline">
        ← All news
      </Link>
      <p className="mt-6 text-xs uppercase tracking-wide text-grey-500">
        {formatDate(post.published_at)}
      </p>
      <h1 className="mt-2 font-display text-3xl leading-tight">
        {post.title}
      </h1>
      {post.excerpt && (
        <p className="mt-4 text-lg text-grey-600">{post.excerpt}</p>
      )}
      {/* body_html is sanitised server-side at save time (see content actions) */}
      <div
        className="prose mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.body_html }}
      />
    </article>
  );
}
