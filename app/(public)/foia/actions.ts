"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;

const submitSchema = z.object({
  organisationId: z.string().uuid("Choose a department or agency"),
  description: z
    .string()
    .min(30, "Describe the information requested (at least 30 characters)")
    .max(5000, "Description too long (5000 characters max)"),
  statement: z.literal("on", {
    message: "You must confirm the request is made under the act",
  }),
});

export async function submitFoiRequestAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to submit a request" };

  const parsed = submitSchema.safeParse({
    organisationId: formData.get("organisationId"),
    description: formData.get("description"),
    statement: formData.get("statement"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;

  const service = createSupabaseServiceClient();
  const { data: org } = await service
    .from("organisations")
    .select("id, name")
    .eq("id", input.organisationId)
    .single();
  if (!org) return { error: "Unknown department" };

  // Reference number: FOIR-000001 style
  const { count } = await service
    .from("foi_requests")
    .select("id", { count: "exact", head: true });
  const reference = `FOIR-${String((count ?? 0) + 1).padStart(6, "0")}`;

  const now = Date.now();
  const { data: created, error } = await service
    .from("foi_requests")
    .insert({
      reference,
      user_id: user.id,
      organisation_id: org.id,
      description: input.description.trim(),
      receipt_due: new Date(now + 3 * DAY_MS).toISOString(),
      decision_due: new Date(now + 14 * DAY_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: error?.message || "Could not submit the request" };
  }

  await logAudit(service, {
    action: "foi.submitted",
    entityType: "foi_requests",
    entityId: created.id,
    orgId: org.id,
    reason: reference,
    actor: user.id,
  });

  revalidatePath("/foia");
  return {
    success: true,
    message: `Request ${reference} submitted to ${org.name}. A receipt is due within 3 days and a decision within 14 days.`,
  };
}

const appealSchema = z.object({
  requestId: z.string().uuid(),
  grounds: z
    .string()
    .min(30, "State the grounds for your appeal (at least 30 characters)")
    .max(5000, "Grounds too long (5000 characters max)"),
});

export async function appealFoiRequestAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const parsed = appealSchema.safeParse({
    requestId: formData.get("requestId"),
    grounds: formData.get("grounds"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("foi_requests")
    .select("id, user_id, organisation_id, status, reference")
    .eq("id", parsed.data.requestId)
    .single();
  if (!request || request.user_id !== user.id) {
    return { error: "Request not found" };
  }
  if (request.status !== "denied") {
    return { error: "Only denied requests can be appealed" };
  }

  const { error } = await service
    .from("foi_requests")
    .update({
      status: "appealed",
      appeal_grounds: parsed.data.grounds.trim(),
      appealed_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "foi.appealed",
    entityType: "foi_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: request.reference,
    actor: user.id,
  });

  revalidatePath("/foia");
  return { success: true, message: "Appeal submitted to the agency" };
}
