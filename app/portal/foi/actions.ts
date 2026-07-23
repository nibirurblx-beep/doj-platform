"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { FOI_EXEMPTIONS } from "@/lib/foi/constants";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const DAY_MS = 24 * 60 * 60 * 1000;

async function getFoiActor(requestId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("foi_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found" as const };

  // The directorate (leadership) of the agency processes requests
  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW, request.organisation_id))) {
    return { error: "You cannot process requests for that agency" as const };
  }
  return { user, request, service };
}

/** Receipt (within 3 days): compliant, or needs correction with steps. */
export async function foiReceiptAction(formData: FormData) {
  const requestId = formData.get("requestId");
  const note = formData.get("note");
  const compliant = formData.get("compliant") === "yes";
  if (typeof requestId !== "string" || typeof note !== "string" || !note.trim()) {
    return { error: "A receipt note is required" };
  }

  const actor = await getFoiActor(requestId);
  if ("error" in actor) return { error: actor.error };
  const { user, request, service } = actor;
  if (request.status !== "submitted") {
    return { error: "A receipt has already been issued" };
  }

  const { error } = await service
    .from("foi_requests")
    .update({
      status: compliant ? "acknowledged" : "needs_correction",
      receipt_note: note.trim().slice(0, 3000),
      handled_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: compliant ? "foi.acknowledged" : "foi.needs_correction",
    entityType: "foi_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: request.reference,
    actor: user.id,
  });
  revalidatePath("/portal/foi");
  revalidatePath("/foia");
  return { success: true, message: "Receipt issued" };
}

/** Late notice: extend to at most 30 days from submission, with reasons. */
export async function foiLateNoticeAction(formData: FormData) {
  const requestId = formData.get("requestId");
  const reason = formData.get("reason");
  const newDate = formData.get("extendedDue");
  if (
    typeof requestId !== "string" ||
    typeof reason !== "string" ||
    !reason.trim() ||
    typeof newDate !== "string" ||
    !newDate
  ) {
    return { error: "A date and the reasons for the delay are required" };
  }

  const actor = await getFoiActor(requestId);
  if ("error" in actor) return { error: actor.error };
  const { user, request, service } = actor;
  if (!["submitted", "acknowledged"].includes(request.status)) {
    return { error: "A late notice cannot be issued at this stage" };
  }

  const extended = new Date(`${newDate}T23:59:59Z`);
  const maxDate = new Date(new Date(request.submitted_at).getTime() + 30 * DAY_MS);
  if (Number.isNaN(extended.getTime()) || extended > maxDate) {
    return {
      error: `The extended date may be no more than 30 days after submission (${maxDate.toLocaleDateString("en-GB")})`,
    };
  }
  if (extended < new Date()) {
    return { error: "The extended date must be in the future" };
  }

  const { error } = await service
    .from("foi_requests")
    .update({
      status: "late_notice",
      extended_due: extended.toISOString(),
      late_reason: reason.trim().slice(0, 3000),
      handled_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "foi.late_notice",
    entityType: "foi_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: request.reference,
    actor: user.id,
  });
  revalidatePath("/portal/foi");
  revalidatePath("/foia");
  return { success: true, message: "Late notice issued" };
}

/** Decision: complete (with the information or where it is located). */
export async function foiCompleteAction(formData: FormData) {
  const requestId = formData.get("requestId");
  const note = formData.get("note");
  if (typeof requestId !== "string" || typeof note !== "string" || !note.trim()) {
    return { error: "Provide the information or where it is located" };
  }

  const actor = await getFoiActor(requestId);
  if ("error" in actor) return { error: actor.error };
  const { user, request, service } = actor;

  const isAppeal = request.status === "appealed";
  if (!["submitted", "acknowledged", "late_notice", "appealed"].includes(request.status)) {
    return { error: "This request is not open" };
  }

  const { error } = await service
    .from("foi_requests")
    .update({
      status: isAppeal ? "appeal_completed" : "completed",
      ...(isAppeal
        ? { appeal_note: note.trim().slice(0, 5000) }
        : { decision_note: note.trim().slice(0, 5000) }),
      decided_at: new Date().toISOString(),
      handled_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: isAppeal ? "foi.appeal_granted" : "foi.completed",
    entityType: "foi_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: request.reference,
    actor: user.id,
  });
  revalidatePath("/portal/foi");
  revalidatePath("/foia");
  return { success: true, message: isAppeal ? "Appeal granted" : "Request completed" };
}

/** Decision: deny, citing statutory exemption(s). Redaction must have been
 *  attempted first - the form makes the processor confirm that. */
export async function foiDenyAction(formData: FormData) {
  const requestId = formData.get("requestId");
  const note = formData.get("note");
  const exemptions = formData.getAll("exemptions").filter(
    (e): e is string => typeof e === "string",
  );
  const redactionConfirmed = formData.get("redactionConfirmed") === "on";

  if (typeof requestId !== "string" || typeof note !== "string" || !note.trim()) {
    return { error: "A denial explanation is required" };
  }

  const actor = await getFoiActor(requestId);
  if ("error" in actor) return { error: actor.error };
  const { user, request, service } = actor;

  const isAppeal = request.status === "appealed";
  if (!["submitted", "acknowledged", "late_notice", "appealed"].includes(request.status)) {
    return { error: "This request is not open" };
  }
  if (!isAppeal) {
    if (exemptions.length === 0) {
      return { error: "A denial must cite at least one statutory exemption" };
    }
    if (exemptions.some((e) => !FOI_EXEMPTIONS.find((x) => x.key === e))) {
      return { error: "Unknown exemption cited" };
    }
    if (!redactionConfirmed) {
      return {
        error:
          "Confirm that every reasonable redaction attempt was made before denying the request in whole",
      };
    }
  }

  const { error } = await service
    .from("foi_requests")
    .update({
      status: isAppeal ? "appeal_denied" : "denied",
      ...(isAppeal
        ? { appeal_note: note.trim().slice(0, 5000) }
        : {
            decision_note: note.trim().slice(0, 5000),
            denial_exemptions: exemptions,
          }),
      decided_at: new Date().toISOString(),
      handled_by: user.id,
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: isAppeal ? "foi.appeal_denied" : "foi.denied",
    entityType: "foi_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: `${request.reference}${exemptions.length ? ` (${exemptions.join(", ")})` : ""}`,
    actor: user.id,
  });
  revalidatePath("/portal/foi");
  revalidatePath("/foia");
  return { success: true, message: isAppeal ? "Appeal denied" : "Request denied" };
}
