import { createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AgForm, AgListItem, type AgRow } from "./widgets";

export const metadata = { title: "Hall of Attorney Generals" };

export default async function HallAdminPage() {
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    redirect("/portal/admin");
  }

  const service = createSupabaseServiceClient();
  const { data: ags } = await service
    .from("attorney_generals")
    .select("id, ordinal, name, term_start, term_end, bio, photo_url")
    .order("ordinal");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl">Hall of Attorney Generals</h2>
        <p className="mt-1 text-sm text-grey-600">
          The department&rsquo;s AG history, shown publicly at{" "}
          <Link href="/hall-of-attorney-generals" className="underline">
            /hall-of-attorney-generals
          </Link>
          . Leave the term end blank for the incumbent.
        </p>
      </div>

      <div className="rounded border border-grey-200 bg-white p-5">
        <h3 className="text-sm font-medium">Add an Attorney General</h3>
        <div className="mt-3">
          <AgForm />
        </div>
      </div>

      <div className="space-y-3">
        {(ags ?? []).length === 0 ? (
          <p className="rounded border border-grey-200 bg-white p-5 text-sm text-grey-600">
            Nobody in the hall yet — add the first Attorney General above.
          </p>
        ) : (
          (ags ?? []).map((ag) => <AgListItem key={ag.id} ag={ag as AgRow} />)
        )}
      </div>
    </div>
  );
}
