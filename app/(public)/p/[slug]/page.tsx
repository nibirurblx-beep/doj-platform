import { createSupabaseServiceClient } from "@/lib/db/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 300;

async function getPage(slug: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("content_posts")
    .select("title, excerpt, body_html, updated_at")
    .eq("type", "page")
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
  const page = await getPage(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title, description: page.excerpt ?? undefined };
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl leading-tight">{page.title}</h1>
      {/* body_html is sanitised server-side at save time (see content actions) */}
      <div
        className="prose mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: page.body_html }}
      />
    </article>
  );
}
