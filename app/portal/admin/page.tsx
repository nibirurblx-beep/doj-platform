import { createSupabaseServiceClient } from "@/lib/db/server";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const service = createSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const [{ count: pending }, { count: accepted }, { count: expired }] =
    await Promise.all([
      service
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", nowIso),
      service
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .not("accepted_at", "is", null),
      service
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .is("accepted_at", null)
        .is("revoked_at", null)
        .lte("expires_at", nowIso),
    ]);

  const cards = [
    { label: "Pending invitations", value: pending ?? 0 },
    { label: "Accepted", value: accepted ?? 0 },
    { label: "Expired", value: expired ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded border border-grey-200 bg-white p-5"
          >
            <p className="text-sm text-grey-600">{card.label}</p>
            <p className="mt-1 font-display text-3xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded border border-grey-200 bg-white p-5">
        <h3 className="font-display text-lg">Quick actions</h3>
        <div className="mt-3">
          <Link
            href="/portal/admin/invitations"
            className="inline-block rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
          >
            Manage invitations
          </Link>
        </div>
      </div>
    </div>
  );
}
