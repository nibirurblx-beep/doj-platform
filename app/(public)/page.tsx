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

// Department card images: drop files into public/brand/departments/
// named doj.jpg, mpd.jpg, fbi.jpg. Cards fall back to navy if missing.
const DEPARTMENTS = [
  {
    code: "DOJ",
    name: "Department of Justice",
    blurb:
      "Prosecution, legal policy and oversight of the justice system across the community.",
    image: "/brand/departments/doj.jpg",
    href: "/departments/doj",
  },
  {
    code: "MPD",
    name: "Metropolitan Police Department",
    blurb:
      "Frontline policing, public safety and criminal investigation within the city.",
    image: "/brand/departments/mpd.png",
    href: "/departments/mpd",
  },
  {
    code: "FBI",
    name: "Federal Bureau of Investigation",
    blurb:
      "Federal investigations, intelligence and specialist operations.",
    image: "/brand/departments/fbi.jpg",
    href: "/departments/fbi",
  },
];

export default async function HomePage() {
  const service = createSupabaseServiceClient();
  const { data: news } = await service
    .from("content_posts")
    .select("slug, title, excerpt, published_at, cover_image_url")
    .eq("type", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <>
      {/* Hero. Banner artwork: /public/brand/hero.svg (swap the file, or
          change the URL below to /brand/hero.jpg for a photo). */}
      <section
        className="relative bg-navy-950 bg-cover bg-center text-white"
        style={{ backgroundImage: "url(/brand/hero.jpg)" }}
      >
        {/* Dark overlay for text contrast: solid on the left where the copy
            sits, easing off to the right. Tune the opacities to taste. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-20 md:flex-row md:items-center md:py-28">
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
            <Seal size={260} />
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
                className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded bg-navy-950 bg-cover bg-center p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                style={
                  post.cover_image_url
                    ? { backgroundImage: `url(${post.cover_image_url})` }
                    : undefined
                }
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-950/60 to-navy-950/20"
                />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold-200">
                    {formatDate(post.published_at)}
                  </p>
                  <h3 className="mt-2 font-display text-xl leading-snug group-hover:underline">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-navy-100 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-4 inline-block rounded bg-gold-600 px-3 py-1.5 text-xs font-semibold text-navy-950">
                    Read more →
                  </span>
                </div>
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
                key={dept.code}
                className="group relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded bg-navy-950 bg-cover bg-center p-6 text-white"
                style={{ backgroundImage: `url(${dept.image})` }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-950/55 to-navy-950/20"
                />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-200">
                    {dept.code}
                  </p>
                  <h3 className="mt-1 font-display text-2xl leading-tight">
                    {dept.name}
                  </h3>
                  <p className="mt-2 text-sm text-navy-100">{dept.blurb}</p>
                  <Link
                    href={dept.href}
                    className="mt-4 inline-block rounded bg-gold-600 px-3 py-1.5 text-xs font-semibold text-navy-950 hover:bg-gold-500"
                  >
                    Explore department →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
