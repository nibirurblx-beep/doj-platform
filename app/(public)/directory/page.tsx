import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Staff Directory" };
export const revalidate = 300;

export default async function DirectoryPage() {
  const service = createSupabaseServiceClient();
  const { data: employees } = await service
    .from("employees")
    .select(
      "id, user_id, rank, organisation_id, organisations(name), offices(name)",
    )
    .eq("status", "active")
    .eq("directory_visible", true)
    .order("organisation_id");

  const userIds = Array.from(new Set((employees ?? []).map((e) => e.user_id)));
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Group by organisation, then division
  const byOrg = new Map<
    string,
    { name: string; divisions: Map<string, Array<{ name: string; rank: string | null }>> }
  >();
  for (const emp of employees ?? []) {
    const orgName =
      (emp.organisations as unknown as { name: string } | null)?.name ?? "Other";
    const divName =
      (emp.offices as unknown as { name: string } | null)?.name ?? "General";
    if (!byOrg.has(orgName)) byOrg.set(orgName, { name: orgName, divisions: new Map() });
    const org = byOrg.get(orgName)!;
    if (!org.divisions.has(divName)) org.divisions.set(divName, []);
    org.divisions.get(divName)!.push({
      name: nameById.get(emp.user_id) || "Staff member",
      rank: emp.rank,
    });
  }

  const organisations = Array.from(byOrg.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl">Staff Directory</h1>
      <p className="mt-3 leading-relaxed text-grey-800">
        Who serves in each department, by division and rank. Listings are
        opt-in: staff appear here only where the department has chosen to
        publish them.
      </p>

      {organisations.length === 0 ? (
        <p className="mt-8 rounded border border-grey-200 bg-white p-6 text-sm text-grey-600">
          No staff are currently listed.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {organisations.map((org) => (
            <section key={org.name}>
              <h2 className="border-b-2 border-gold-500 pb-2 font-display text-xl text-navy-900">
                {org.name}
              </h2>
              <div className="mt-3 space-y-4">
                {Array.from(org.divisions.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([division, members]) => (
                    <div key={division}>
                      <h3 className="text-sm font-medium uppercase tracking-wide text-grey-500">
                        {division}
                      </h3>
                      <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {members
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((member, i) => (
                            <li
                              key={i}
                              className="rounded border border-grey-200 bg-white px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{member.name}</span>
                              {member.rank && (
                                <span className="text-grey-600"> · {member.rank}</span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
