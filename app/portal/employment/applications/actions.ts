"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireApplicationActor(permission: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  if (!(await hasPermissionAnywhere(permission))) {
    return { error: "You do not have permission to do this" as const };
  }
  return { userId: user.id };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["under_review", "interview", "accepted", "rejected"]),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ["under_review", "interview", "accepted", "rejected"],
  under_review: ["interview", "accepted", "rejected"],
  interview: ["accepted", "rejected", "under_review"],
  accepted: [],
  rejected: ["under_review"], // allow reopening a rejection
  withdrawn: [],
};

export async function changeApplicationStatusAction(formData: FormData) {
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid request" };

  const actor = await requireApplicationActor(
    PERMISSIONS.APPLICATIONS_STATUS_CHANGE,
  );
  if ("error" in actor) return { error: actor.error };

  const service = createSupabaseServiceClient();
  const { data: application } = await service
    .from("applications")
    .select("id, status")
    .eq("id", parsed.data.id)
    .single();
  if (!application) return { error: "Application not found" };

  const allowed = VALID_TRANSITIONS[application.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return {
      error: `Cannot move from "${application.status}" to "${parsed.data.status}"`,
    };
  }

  const { error: updateError } = await service
    .from("applications")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (updateError) return { error: updateError.message };

  await logAudit(service, {
    action: `application.status.${parsed.data.status}`,
    entityType: "application",
    entityId: parsed.data.id,
    before: { status: application.status },
    after: { status: parsed.data.status },
    actor: actor.userId,
  });

  revalidatePath("/portal/employment/applications");
  revalidatePath(`/portal/employment/applications/${parsed.data.id}`);
  return { success: true, message: "Status updated" };
}

const noteSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().min(1, "Note cannot be empty").max(5000),
});

export async function addApplicationNoteAction(formData: FormData) {
  const parsed = noteSchema.safeParse({
    applicationId: formData.get("applicationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const actor = await requireApplicationActor(
    PERMISSIONS.APPLICATIONS_NOTES_INTERNAL,
  );
  if ("error" in actor) return { error: actor.error };

  const service = createSupabaseServiceClient();

  const { data: application } = await service
    .from("applications")
    .select("id")
    .eq("id", parsed.data.applicationId)
    .single();
  if (!application) return { error: "Application not found" };

  const { data: note, error: insertError } = await service
    .from("application_notes")
    .insert({
      application_id: parsed.data.applicationId,
      author_id: actor.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (insertError || !note) {
    return { error: insertError?.message || "Failed to add note" };
  }

  await logAudit(service, {
    action: "application.note.added",
    entityType: "application",
    entityId: parsed.data.applicationId,
    actor: actor.userId,
  });

  revalidatePath(`/portal/employment/applications/${parsed.data.applicationId}`);
  return { success: true, message: "Note added" };
}

/** Schedule an interview: moves the application to the interview stage
 *  with a date/time the applicant can see on their dashboard. */
export async function scheduleInterviewAction(formData: FormData) {
  const actor = await requireApplicationActor(
    PERMISSIONS.APPLICATIONS_STATUS_CHANGE,
  );
  if ("error" in actor) return { error: actor.error };

  const applicationId = formData.get("applicationId");
  const interviewAt = formData.get("interviewAt");
  const note = formData.get("note");
  if (
    typeof applicationId !== "string" ||
    typeof interviewAt !== "string" ||
    !interviewAt
  ) {
    return { error: "An interview date and time is required" };
  }
  const when = new Date(interviewAt);
  if (Number.isNaN(when.getTime()) || when < new Date()) {
    return { error: "The interview must be in the future" };
  }

  const service = createSupabaseServiceClient();
  const { data: application } = await service
    .from("applications")
    .select("id, status, organisation_id")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "Application not found" };
  if (!["submitted", "under_review"].includes(application.status)) {
    return { error: "Interviews can only be scheduled during review" };
  }

  const { error } = await service
    .from("applications")
    .update({
      status: "interview",
      interview_at: when.toISOString(),
      interview_note:
        typeof note === "string" ? note.trim().slice(0, 1000) || null : null,
    })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "application.interview_scheduled",
    entityType: "applications",
    entityId: applicationId,
    orgId: application.organisation_id,
    reason: when.toISOString(),
    actor: actor.userId,
  });
  revalidatePath(`/portal/employment/applications/${applicationId}`);
  revalidatePath("/portal/employment/applications");
  return {
    success: true,
    message: "Interview scheduled - the applicant can see the details",
  };
}
