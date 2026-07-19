import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import {
  CreateOrganisationForm,
  CreateDivisionInline,
  RenameForm,
  DeleteEntityButton,
} from "./widgets";

export const metadata = { title: "Organisation" };

export default async function OrganisationAdminPage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    redirect("/portal/admin");
  }

  const service = createSupabaseServiceClient();

  const [{ data: organisations }, { data: divisions }, { data: memberCounts }] =
    await Promise.all([
      service.from("organisations").select("id, name, slug").order("name"),
      service
        .from("offices")
        .select("id, name, organisation_id")
        .order("name"),
      service.from("memberships").select("organisation_id"),
    ]);

  const countByOrg = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    countByOrg.set(m.organisation_id, (countByOrg.get(m.organisation_id) ?? 0) + 1);
  }
  const divisionsByOrg = new Map<string, NonNullable<typeof divisions>>();
  for (const d of divisions ?? []) {
    const list = divisionsByOrg.get(d.organisation_id) ?? [];
    list.push(d);
    divisionsByOrg.set(d.organisation_id, list);
  }

  return (
    <div className="space-y-8">
      {/* Organisations */}
      <div>
        <h2 className="font-display text-xl">Organisations</h2>
        <p className="mt-1 text-sm text-grey-600">
          Departments of the community. New organisations get the standard
          Staff, Leadership and Content Author roles automatically. The slug
          is permanent: it drives employee numbers (e.g. DHS-000001) and the
          department&rsquo;s private documents folder.
        </p>

        <div className="mt-4 rounded border border-grey-200 bg-white p-4">
          <CreateOrganisationForm />
        </div>

        <div className="mt-4 space-y-3">
          {(organisations ?? []).map((org) => {
            const orgDivisions = divisionsByOrg.get(org.id) ?? [];
            const members = countByOrg.get(org.id) ?? 0;
            return (
              <div key={org.id} className="rounded border border-grey-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {org.name}{" "}
                      <span className="ml-1 rounded bg-grey-100 px-1.5 py-0.5 font-mono text-xs uppercase text-grey-600">
                        {org.slug}
                      </span>
                    </p>
                    <p className="text-xs text-grey-500">
                      {members} member{members === 1 ? "" : "s"} ·{" "}
                      {orgDivisions.length} division
                      {orgDivisions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RenameForm id={org.id} currentName={org.name} kind="organisation" />
                    <DeleteEntityButton id={org.id} name={org.name} kind="organisation" />
                  </div>
                </div>

                {/* Divisions within this organisation */}
                <div className="mt-3 border-t border-grey-100 pt-3">
                  {orgDivisions.length === 0 ? (
                    <p className="text-xs text-grey-500">No divisions yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {orgDivisions.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded bg-grey-050 px-2 py-1.5"
                        >
                          <span className="text-sm">{d.name}</span>
                          <span className="flex items-center gap-2">
                            <RenameForm id={d.id} currentName={d.name} kind="division" />
                            <DeleteEntityButton id={d.id} name={d.name} kind="division" />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create division */}
      <div>
        <h2 className="font-display text-xl">Add a division/team</h2>
        <p className="mt-1 text-sm text-grey-600">
          Divisions appear in the invite, convert, add-employee and user
          management forms, e.g. United States Attorney&rsquo;s Office.
        </p>
        <div className="mt-4 rounded border border-grey-200 bg-white p-4">
          <CreateDivisionInline organisations={organisations ?? []} />
        </div>
      </div>
    </div>
  );
}
