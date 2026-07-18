import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  orgId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  /** The acting user. REQUIRED for service-role calls, where auth.uid() is null. */
  actor?: string | null;
}

/**
 * Write an audit log entry and surface failures to the server log.
 * Audit writes must never break the user-facing operation, but they must
 * also never fail silently (that is how Phases 1D-1G lost their trail).
 */
export async function logAudit(
  client: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await client.rpc("audit_log", {
    p_action: entry.action,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId ?? null,
    p_org_id: entry.orgId ?? null,
    p_before: entry.before ?? null,
    p_after: entry.after ?? null,
    p_reason: entry.reason ?? null,
    p_actor: entry.actor ?? null,
  });
  if (error) {
    console.error(
      `AUDIT WRITE FAILED [${entry.action}] ${entry.entityType}/${entry.entityId ?? "-"}: ${error.message}`,
    );
  }
}
