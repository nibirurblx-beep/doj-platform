"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { z } from "zod";

interface Question {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "yes_no" | "select";
  required: boolean;
  options?: string[];
}

const submitSchema = z.object({
  vacancyId: z.string().uuid(),
});

export async function submitApplicationAction(formData: FormData) {
  const parsed = submitSchema.safeParse({
    vacancyId: formData.get("vacancyId"),
  });
  if (!parsed.success) return { error: "Invalid request" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to apply" };

  const service = createSupabaseServiceClient();

  const { data: vacancy } = await service
    .from("vacancies")
    .select("id, title, status, questions")
    .eq("id", parsed.data.vacancyId)
    .single();

  if (!vacancy || vacancy.status !== "open") {
    return { error: "This vacancy is not open for applications" };
  }

  // One application per vacancy per person
  const { data: existing } = await service
    .from("applications")
    .select("id, status")
    .eq("vacancy_id", vacancy.id)
    .eq("user_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: "You have already applied for this vacancy" };
  }

  // Validate answers against the vacancy's question definitions server-side
  const questions = (vacancy.questions as Question[]) ?? [];
  const answers: Record<string, string> = {};

  for (const q of questions) {
    const raw = formData.get(`q_${q.id}`);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (q.required && !value) {
      return { error: `"${q.label}" is required` };
    }
    if (!value) continue;

    if (q.type === "yes_no" && !["Yes", "No"].includes(value)) {
      return { error: `"${q.label}" must be Yes or No` };
    }
    if (q.type === "select" && q.options && !q.options.includes(value)) {
      return { error: `"${q.label}" has an invalid choice` };
    }
    if (q.type === "short_text" && value.length > 300) {
      return { error: `"${q.label}" is too long (max 300 characters)` };
    }
    if (q.type === "long_text" && value.length > 5000) {
      return { error: `"${q.label}" is too long (max 5000 characters)` };
    }

    answers[q.id] = value;
  }

  const { data: application, error: insertError } = await service
    .from("applications")
    .insert({
      vacancy_id: vacancy.id,
      user_id: user.id,
      answers,
    })
    .select("id, app_number")
    .single();

  if (insertError || !application) {
    return { error: insertError?.message || "Failed to submit application" };
  }

  await logAudit(service, {
    action: "application.submitted",
    entityType: "application",
    entityId: application.id,
    actor: user.id,
  });

  return {
    success: true,
    appNumber: application.app_number as string,
  };
}
