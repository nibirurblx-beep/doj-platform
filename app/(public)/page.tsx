import { createSupabaseServiceClient } from "@/lib/db/server";
import { Seal } from "@/components/brand/seal";
import Link from "next/link";

export const revalidate = 300; // refresh published content every 5 minutes

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const DEPARTMENTS = [
  {
    name: "Department of Justice",
    blurb:
      "Prosecution, legal policy and oversight of the justice system across the community.",
  },
  {
    name: "Metropolitan Police Department",
    blurb:
      "Frontline policing, public safety and criminal investigation within the city.",
  },
  {
    name: "Federal Bureau of Investigation",
    blurb:
      "Federal investigations, intelligence and specialist operations.",
  },
];

export default async function HomePage() {
  const service = createSupabaseServiceClient();
  const { data: news } = await service
    .from("content_posts")
    .select("slug, title, excerpt, published_at")
    .eq("type", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-20 md:flex-row md:items-center md:py-28">
          <div className="flex-1">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-200">
              Department of Justice
            </p>
            <h1 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
              Upholding the rule of law across the community
            </h1>
            <p className="mt-6 max-w-measure text-lg text-navy-100">
              News, legal resources and career opportunities from the
              Department of Justice roleplay community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/news"
                className="rounded bg-gold-600 px-5 py-2.5 text-sm font-medium text-navy-950 hover:bg-gold-500"
              >
                Latest news
              </Link>
              <Link
                href="/auth/login"
                className="rounded border border-navy-400 px-5 py-2.5 text-sm font-medium text-white hover:border-white"
              >
                Staff portal
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <Seal size={180} />
          </div>
        </div>
      </section>

      {/* Latest news */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Latest news</h2>
          <Link href="/news" className="text-sm text-navy-900 underline">
            All news
          </Link>
        </div>

        {!news || news.length === 0 ? (
          <p className="mt-4 max-w-measure text-grey-500">
            No announcements yet. Check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {news.map((post) => (
              <Link
                key={post.slug}
                href={`/news/${post.slug}`}
                className="group rounded border border-grey-200 bg-white p-5 transition hover:border-navy-900"
              >
                <p className="text-xs uppercase tracking-wide text-grey-500">
                  {formatDate(post.published_at)}
                </p>
                <h3 className="mt-2 font-display text-lg leading-snug group-hover:underline">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-grey-600">{post.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Departments */}
      <section className="border-t border-grey-200 bg-grey-050">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-2xl">Our departments</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.name}
                className="rounded border border-grey-200 bg-white p-5"
              >
                <h3 className="font-display text-lg">{dept.name}</h3>
                <p className="mt-2 text-sm text-grey-600">{dept.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
