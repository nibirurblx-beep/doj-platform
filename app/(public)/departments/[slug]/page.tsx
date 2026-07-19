import { createSupabaseServiceClient } from "@/lib/db/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300;

// Department presentation. Images live in public/brand/departments/.
export const DEPARTMENT_CONTENT: Record<
  string,
  { code: string; image: string; tagline: string; description: string }
> = {
  doj: {
    code: "DOJ",
    image: "/brand/departments/doj.jpg",
    tagline: "Prosecution, legal policy and oversight",
    description:
      "The Department of Justice leads prosecution, legal policy and oversight of the justice system across the community. Its attorneys, clerks and support staff handle casework, advise other departments and uphold due process in every roleplay scenario.",
  },
  mpd: {
    code: "MPD",
    image: "/brand/departments/mpd.png",
    tagline: "Frontline policing and public safety",
    description:
      "The Metropolitan Police Department is the community's frontline policing agency: patrol, response, public safety and criminal investigation within the city. Officers work day-to-day scenarios and feed cases through to the DOJ.",
  },
  fbi: {
    code: "FBI",
    image: "/brand/departments/fbi.jpg",
    tagline: "Federal investigations and specialist operations",
    description:
      "The Federal Bureau of Investigation handles federal investigations, intelligence and specialist operations. Agents take on the community's most complex cases, working alongside the MPD and reporting through the Department of Justice.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = DEPARTMENT_CONTENT[slug];
  return { title: content ? content.code : "Department" };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = DEPARTMENT_CONTENT[slug];
  if (!content) notFound();

  const service = createSupabaseServiceClient();
  const { data: org } = await service
    .from("organisations")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!org) notFound();

  const { data: vacancies } = await service
    .from("vacancies")
    .select("slug, title, summary")
    .eq("organisation_id", org.id)
    .eq("status", "open")
    .order("title")
    .limit(20);

  return (
    <div>
      {/* Department hero */}
      <section
        className="relative bg-navy-950 bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${content.image})` }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-200">
            {content.code}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl leading-tight md:text-5xl">
            {org.name}
          </h1>
          <p className="mt-3 max-w-xl text-navy-100">{content.tagline}</p>
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl">About the department</h2>
        <p className="mt-4 max-w-3xl text-grey-700">{content.description}</p>
      </section>

      {/* Open positions */}
      <section className="border-t border-grey-200 bg-grey-050">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Open positions</h2>
            <Link href="/careers" className="text-sm text-navy-900 underline">
              All careers
            </Link>
          </div>
          {(vacancies ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-grey-600">
              No open positions right now. Check back soon or browse all
              careers.
            </p>
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {(vacancies ?? []).map((vacancy) => (
                <Link
                  key={vacancy.slug}
                  href={`/careers/${vacancy.slug}`}
                  className="group rounded border border-grey-200 bg-white p-5 transition hover:border-navy-900"
                >
                  <h3 className="font-display text-lg group-hover:underline">
                    {vacancy.title}
                  </h3>
                  {vacancy.summary && (
                    <p className="mt-2 text-sm text-grey-600">{vacancy.summary}</p>
                  )}
                  <span className="mt-3 inline-block text-sm text-navy-900 underline">
                    View and apply
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
