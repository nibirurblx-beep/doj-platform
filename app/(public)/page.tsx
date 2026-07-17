export default function HomePage() {
  return (
    <>
      {/* Editorial feature area. Placeholder structure only: the full
          public design and CMS-driven content arrive in Phase 1D. */}
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-200">
            Department of Justice
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Upholding the rule of law across the community
          </h1>
          <p className="mt-6 max-w-measure text-lg text-navy-100">
            News, legal resources and career opportunities from the Department
            of Justice roleplay community.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl">Latest news</h2>
        <p className="mt-4 max-w-measure text-grey-500">
          Published news and announcements will appear here once the content
          management system goes live.
        </p>
      </section>
    </>
  );
}
