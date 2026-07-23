import { createSupabaseServiceClient } from "@/lib/db/server";
import { getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { redirect } from "next/navigation";
import { FOI_STATUS_LABELS, FOI_OPEN_STATUSES, FOI_EXEMPTIONS } from "@/lib/foi/constants";
import { FoiControls } from "./widgets";

export const metadata = { title: "FOI requests" };

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function FoiQueuePage() {
  const scope = await getPermittedOrgIds(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW);
  if (!scope.all && scope.orgIds.length === 0) {
    redirect("/portal?denied=FOI requests");
  }

  const service = createSupabaseServiceClient();
  let query = service
    .from("foi_requests")
    .select(
      "id, reference, status, description, submitted_at, receipt_due, decision_due, extended_due, receipt_note, late_reason, decision_note, denial_exemptions, appeal_grounds, appeal_note, user_id, organisations(name)",
    )
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (!scope.all) query = query.in("organisation_id", scope.orgIds);
  const { data: requests } = await query;

  // Requester names
  const userIds = Array.from(new Set((requests ?? []).map((r) => r.user_id)));
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const now = Date.now();
  const open = (requests ?? []).filter((r) => FOI_OPEN_STATUSES.includes(r.status) || r.status === "needs_correction");
  const closed = (requests ?? []).filter((r) => !FOI_OPEN_STATUSES.includes(r.status) && r.status !== "needs_correction");

  const card = (req: NonNullable<typeof requests>[number]) => {
    const due = new Date(req.extended_due ?? req.decision_due).getTime();
    const receiptOverdue =
      req.status === "submitted" && now > new Date(req.receipt_due).getTime();
    const decisionOverdue =
      FOI_OPEN_STATUSES.includes(req.status) && req.status !== "appealed" && now > due;
    const dueSoon =
      !decisionOverdue &&
      FOI_OPEN_STATUSES.includes(req.status) &&
      due - now < 3 * DAY_MS;

    return (
      <div key={req.id} className="rounded border border-grey-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm">{req.reference}</p>
          <span className="flex items-center gap-2">
            {(receiptOverdue || decisionOverdue) && (
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                {receiptOverdue ? "Receipt overdue" : "Decision overdue"}
              </span>
            )}
            {dueSoon && !receiptOverdue && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Due soon
              </span>
            )}
            <span className="rounded bg-grey-100 px-2 py-0.5 text-xs font-medium">
              {FOI_STATUS_LABELS[req.status] ?? req.status}
            </span>
          </span>
        </div>
        <p className="mt-1 text-xs text-grey-500">
          {(req.organisations as unknown as { name: string } | null)?.name} ·
          from {nameById.get(req.user_id) || "Unknown"} · submitted{" "}
          {formatDate(req.submitted_at)} · receipt due {formatDate(req.receipt_due)} ·
          decision due {formatDate(req.extended_due ?? req.decision_due)}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-grey-800">
          {req.description}
        </p>

        {req.appeal_grounds && (
          <div className="mt-3 rounded bg-amber-50 p-3 text-sm">
            <p className="text-xs font-medium uppercase text-amber-700">
              Appeal grounds
            </p>
            <p className="mt-1 whitespace-pre-wrap">{req.appeal_grounds}</p>
          </div>
        )}
        {req.decision_note && (
          <div className="mt-3 rounded bg-grey-050 p-3 text-sm">
            <p className="text-xs font-medium uppercase text-grey-500">Decision</p>
            <p className="mt-1 whitespace-pre-wrap">{req.decision_note}</p>
            {(req.denial_exemptions ?? []).length > 0 && (
              <p className="mt-1 text-xs text-grey-600">
                Exemptions:{" "}
                {(req.denial_exemptions ?? [])
                  .map((k: string) => `(${k}) ${FOI_EXEMPTIONS.find((e) => e.key === k)?.label ?? ""}`)
                  .join("; ")}
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <FoiControls
            requestId={req.id}
            status={req.status}
            maxExtendedDate={new Date(
              new Date(req.submitted_at).getTime() + 30 * DAY_MS,
            )
              .toISOString()
              .slice(0, 10)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl">FOI requests</h1>
        <p className="mt-1 text-sm text-grey-600">
          Freedom of Information Requests for your department. Receipts are
          due within 3 days of submission, decisions within 14 (or the late
          notice date, capped at 30). Denials must cite statutory exemptions
          and are appealable.
        </p>
      </div>

      <div>
        <h2 className="font-medium">Open ({open.length})</h2>
        <div className="mt-3 space-y-4">
          {open.length === 0 ? (
            <p className="rounded border border-grey-200 bg-white p-5 text-sm text-grey-600">
              No open requests.
            </p>
          ) : (
            open.map(card)
          )}
        </div>
      </div>

      {closed.length > 0 && (
        <div>
          <h2 className="font-medium">Closed ({closed.length})</h2>
          <div className="mt-3 space-y-4">{closed.map(card)}</div>
        </div>
      )}
    </div>
  );
}
