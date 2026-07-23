import "server-only";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { getPermittedOrgIds } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { FOI_OPEN_STATUSES } from "@/lib/foi/constants";
import type { PortalTask } from "@/components/portal/notifications-bell";

/** Everything currently awaiting this user, across features. */
export async function getPortalTasks(userId: string): Promise<PortalTask[]> {
  const service = createSupabaseServiceClient();
  const tasks: PortalTask[] = [];

  // Signatures assigned to me / countersignatures I owe
  const { data: signatures } = await service
    .from("signature_requests")
    .select("id, title, status, user_id, requested_by")
    .or(
      `and(user_id.eq.${userId},status.eq.pending),and(requested_by.eq.${userId},status.eq.pending_employer)`,
    )
    .limit(10);
  for (const sig of signatures ?? []) {
    tasks.push({
      href: `/portal/sign/${sig.id}`,
      label:
        sig.status === "pending"
          ? `Sign: ${sig.title}`
          : `Countersign: ${sig.title}`,
    });
  }

  // FOI queue for departments I lead
  const foiScope = await getPermittedOrgIds(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW);
  if (foiScope.all || foiScope.orgIds.length > 0) {
    let query = service
      .from("foi_requests")
      .select("id, reference, status, receipt_due, decision_due, extended_due")
      .in("status", [...FOI_OPEN_STATUSES]);
    if (!foiScope.all) query = query.in("organisation_id", foiScope.orgIds);
    const { data: foi } = await query.limit(20);
    const now = Date.now();
    for (const req of foi ?? []) {
      const receiptOverdue =
        req.status === "submitted" && now > new Date(req.receipt_due).getTime();
      const decisionOverdue =
        req.status !== "appealed" &&
        now > new Date(req.extended_due ?? req.decision_due).getTime();
      tasks.push({
        href: "/portal/foi",
        label:
          req.status === "appealed"
            ? `FOI appeal: ${req.reference}`
            : `FOI request: ${req.reference}`,
        detail: receiptOverdue
          ? "Receipt overdue"
          : decisionOverdue
            ? "Decision overdue"
            : undefined,
        urgent: receiptOverdue || decisionOverdue,
      });
    }

    // Applications awaiting review in my departments
    let appQuery = service
      .from("applications")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted"]);
    if (!foiScope.all) appQuery = appQuery.in("organisation_id", foiScope.orgIds);
    const { count: newApps } = await appQuery;
    if ((newApps ?? 0) > 0) {
      tasks.push({
        href: "/portal/employment/applications",
        label: `${newApps} new application${newApps === 1 ? "" : "s"} awaiting review`,
      });
    }
  }

  return tasks;
}
