import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Hall of Attorney Generals",
  description:
    "The Attorneys General who have led the Department of Justice.",
};
export const revalidate = 300;

function ordinalLabel(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

function formatTerm(start: string, end: string | null) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${fmt(start)} — ${end ? fmt(end) : "Present"}`;
}

export default async function HallPage() {
  const service = createSupabaseServiceClient();
  const { data: ags } = await service
    .from("attorney_generals")
    .select("id, ordinal, name, term_start, term_end, bio, photo_url")
    .order("ordinal");

  const incumbent = (ags ?? []).find((ag) => !ag.term_end);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-700">
          Department of Justice
        </p>
        <h1 className="mt-2 font-display text-4xl">Hall of Attorney Generals</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-grey-800">
          The Attorneys General who have led the Department of Justice — the
          department&rsquo;s chief law officers, from its founding to the
          present day.
        </p>
      </div>

      {(ags ?? []).length === 0 ? (
        <p className="mx-auto mt-12 max-w-md rounded border border-grey-200 bg-white p-6 text-center text-sm text-grey-600">
          The hall is being prepared.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(ags ?? []).map((ag) => {
            const isIncumbent = incumbent?.id === ag.id;
            return (
              <figure
                key={ag.id}
                className={`overflow-hidden rounded border bg-white shadow-sm ${
                  isIncumbent ? "border-gold-500 ring-1 ring-gold-500" : "border-grey-200"
                }`}
              >
                <div className="relative bg-navy-900">
                  {ag.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ag.photo_url}
                      alt={`Portrait of ${ag.name}`}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center">
                      <span className="font-display text-6xl text-navy-700">
                        {ag.ordinal}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded bg-navy-900/90 px-2 py-0.5 text-xs font-medium text-gold-200">
                    {ordinalLabel(ag.ordinal)} Attorney General
                  </span>
                  {isIncumbent && (
                    <span className="absolute right-3 top-3 rounded bg-gold-600 px-2 py-0.5 text-xs font-bold text-navy-950">
                      Incumbent
                    </span>
                  )}
                </div>
                <figcaption className="border-t-4 border-gold-500 p-4">
                  <h2 className="font-display text-lg text-navy-900">{ag.name}</h2>
                  <p className="mt-0.5 text-xs text-grey-500">
                    {formatTerm(ag.term_start, ag.term_end)}
                  </p>
                  {ag.bio && (
                    <p className="mt-2 text-sm leading-relaxed text-grey-700">
                      {ag.bio}
                    </p>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
