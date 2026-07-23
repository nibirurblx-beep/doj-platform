import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Staff Directory" };
export const revalidate = 300;

interface Member {
  name: string;
  rank: string | null;
  photoUrl: string | null;
  isLeadership: boolean;
}

function PersonCard({ member, large = false }: { member: Member; large?: boolean }) {
  const size = large ? "h-16 w-16" : "h-12 w-12";
  return (
    <div
      className={`flex items-center gap-3 rounded border bg-white px-3 py-2.5 shadow-sm ${
        member.isLeadership ? "border-gold-500" : "border-grey-200"
      }`}
    >
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photoUrl}
          alt={member.name}
          className={`${size} shrink-0 rounded-full object-cover ${
            member.isLeadership ? "ring-2 ring-gold-500" : ""
          }`}
        />
      ) : (
        <div
          className={`${size} flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-display text-white ${
            member.isLeadership ? "ring-2 ring-gold-500" : ""
          }`}
        >
          {member.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-900">{member.name}</p>
        {member.rank && (
          <p className="truncate text-xs text-grey-600">{member.rank}</p>
        )}
        {member.isLeadership && (
          <p className="text-[10px] font-medium uppercase tracking-wide text-gold-700">
            Leadership
          </p>
        )}
      </div>
    </div>
  );
}

export default async function DirectoryPage() {
  const service = createSupabaseServiceClient();
  const { data: employees } = await service
    .from("employees")
    .select(
      "id, user_id, rank, photo_url, organisation_id, organisations(name), offices(name)",
    )
    .eq("status", "active")
    .eq("directory_visible", true);

  const userIds = Array.from(new Set((employees ?? []).map((e) => e.user_id)));
  const [{ data: profiles }, { data: leadershipRows }] = await Promise.all([
    userIds.length
      ? service.from("profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? service
          .from("membership_roles")
          .select("memberships!inner(user_id, organisation_id), roles!inner(key)")
          .eq("roles.key", "leadership")
          .in("memberships.user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const leadershipSet = new Set(
    (leadershipRows ?? []).map((row) => {
      const m = row.memberships as unknown as {
        user_id: string;
        organisation_id: string;
      };
      return `${m.organisation_id}:${m.user_id}`;
    }),
  );

  // Group: organisation -> { leadership[], divisions: Map<division, members[]> }
  const byOrg = new Map<
    string,
    { name: string; leadership: Member[]; divisions: Map<string, Member[]> }
  >();
  for (const emp of employees ?? []) {
    const orgName =
      (emp.organisations as unknown as { name: string } | null)?.name ?? "Other";
    if (!byOrg.has(orgName)) {
      byOrg.set(orgName, { name: orgName, leadership: [], divisions: new Map() });
    }
    const org = byOrg.get(orgName)!;
    const member: Member = {
      name: nameById.get(emp.user_id) || "Staff member",
      rank: emp.rank,
      photoUrl: emp.photo_url,
      isLeadership: leadershipSet.has(`${emp.organisation_id}:${emp.user_id}`),
    };
    if (member.isLeadership) {
      org.leadership.push(member);
    } else {
      const divName =
        (emp.offices as unknown as { name: string } | null)?.name ?? "General";
      if (!org.divisions.has(divName)) org.divisions.set(divName, []);
      org.divisions.get(divName)!.push(member);
    }
  }

  const organisations = Array.from(byOrg.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl">Staff Directory</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-grey-800">
        The structure of each department: leadership, divisions and staff.
        Listings are opt-in — staff appear only where their department has
        chosen to publish them.
      </p>

      {organisations.length === 0 ? (
        <p className="mt-8 rounded border border-grey-200 bg-white p-6 text-sm text-grey-600">
          No staff are currently listed.
        </p>
      ) : (
        <div className="mt-10 space-y-14">
          {organisations.map((org) => {
            const divisions = Array.from(org.divisions.entries()).sort(
              ([a], [b]) => a.localeCompare(b),
            );
            return (
              <section key={org.name}>
                {/* Department node */}
                <div className="flex justify-center">
                  <div className="rounded border-b-4 border-gold-500 bg-navy-900 px-8 py-3 text-center shadow">
                    <h2 className="font-display text-xl text-white">{org.name}</h2>
                  </div>
                </div>

                {/* Leadership tier */}
                {org.leadership.length > 0 && (
                  <>
                    <div className="mx-auto h-6 w-px bg-grey-300" />
                    <div className="flex flex-wrap justify-center gap-3">
                      {org.leadership
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((member, i) => (
                          <PersonCard key={i} member={member} large />
                        ))}
                    </div>
                  </>
                )}

                {/* Connector + division branches */}
                {divisions.length > 0 && (
                  <>
                    <div className="mx-auto h-6 w-px bg-grey-300" />
                    <div className="mx-auto hidden h-px bg-grey-300 md:block" style={{ width: "70%" }} />
                    <div className="mt-0 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {divisions.map(([division, members]) => (
                        <div key={division} className="flex flex-col items-center">
                          <div className="hidden h-6 w-px bg-grey-300 md:block" />
                          <div className="w-full rounded border border-grey-200 bg-grey-050 p-3">
                            <h3 className="border-b border-gold-500 pb-1.5 text-center text-sm font-medium uppercase tracking-wide text-navy-900">
                              {division}
                            </h3>
                            <div className="mt-2.5 space-y-2">
                              {members
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((member, i) => (
                                  <PersonCard key={i} member={member} />
                                ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
