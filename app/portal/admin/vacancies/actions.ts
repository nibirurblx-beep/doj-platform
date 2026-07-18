"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

function cleanHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr",
      "strong", "em", "u", "s", "code", "pre", "blockquote",
      "ul", "ol", "li", "a",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["https", "http", "mailto"],
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Every question needs a label").max(300),
  type: z.enum(["short_text", "long_text", "yes_no", "select"]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export type VacancyQuestion = z.infer<typeof questionSchema>;

const vacancySchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().max(80).optional().or(z.literal("")),
  summary: z.string().max(300).optional().or(z.literal("")),
  organisationId: z.string().uuid("Choose an organisation"),
  descriptionHtml: z.string().max(100_000),
  questionsJson: z.string().max(100_000),
});

function parseQuestions(raw: string):
  | { questions: VacancyQuestion[]; error?: never }
  | { questions?: never; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return { error: "Questions are malformed" };
  }
  const result = z.array(questionSchema).max(30).safeParse(parsed);
  if (!result.success) {
    return { error: "Questions are invalid: " + (result.error.issues[0]?.message ?? "") };
  }
  for (const q of result.data) {
    if (q.type === "select" && (!q.options || q.options.length < 2)) {
      return { error: `"${q.label}" needs at least two options` };
    }
  }
  return { questions: result.data };
}

async function requireVacancyActor(permission: string) {
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

export async function createVacancyAction(formData: FormData) {
  const parsed = vacancySchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    summary: formData.get("summary") ?? "",
    organisationId: formData.get("organisationId"),
    descriptionHtml: formData.get("descriptionHtml") ?? "",
    questionsJson: formData.get("questionsJson") ?? "[]",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const actor = await requireVacancyActor(PERMISSIONS.VACANCIES_MANAGE);
  if ("error" in actor) return { error: actor.error };

  const q = parseQuestions(parsed.data.questionsJson);
  if (q.error) return { error: q.error };

  const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.title);
  if (!slug) return { error: "Could not derive a slug from the title" };

  const service = createSupabaseServiceClient();
  const { data: clash } = await service
    .from("vacancies")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  if (clash && clash.length > 0) {
    return { error: `A vacancy with slug "${slug}" already exists` };
  }

  const { data: vacancy, error: insertError } = await service
    .from("vacancies")
    .insert({
      title: parsed.data.title,
      slug,
      summary: parsed.data.summary || null,
      organisation_id: parsed.data.organisationId,
      description_html: cleanHtml(parsed.data.descriptionHtml),
      questions: q.questions,
      status: "draft",
      created_by: actor.userId,
    })
    .select("id")
    .single();

  if (insertError || !vacancy) {
    return { error: insertError?.message || "Failed to create vacancy" };
  }

  await logAudit(service, {
    action: "vacancy.created",
    entityType: "vacancy",
    entityId: vacancy.id,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/vacancies");
  redirect(`/portal/admin/vacancies/${vacancy.id}`);
}

export async function updateVacancyAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing id" };

  const parsed = vacancySchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    summary: formData.get("summary") ?? "",
    organisationId: formData.get("organisationId"),
    descriptionHtml: formData.get("descriptionHtml") ?? "",
    questionsJson: formData.get("questionsJson") ?? "[]",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const actor = await requireVacancyActor(PERMISSIONS.VACANCIES_MANAGE);
  if ("error" in actor) return { error: actor.error };

  const q = parseQuestions(parsed.data.questionsJson);
  if (q.error) return { error: q.error };

  const service = createSupabaseServiceClient();
  const { data: current } = await service
    .from("vacancies")
    .select("id, slug")
    .eq("id", id)
    .single();
  if (!current) return { error: "Vacancy not found" };

  const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.title);
  if (slug !== current.slug) {
    const { data: clash } = await service
      .from("vacancies")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .limit(1);
    if (clash && clash.length > 0) {
      return { error: `A vacancy with slug "${slug}" already exists` };
    }
  }

  const { error: updateError } = await service
    .from("vacancies")
    .update({
      title: parsed.data.title,
      slug,
      summary: parsed.data.summary || null,
      organisation_id: parsed.data.organisationId,
      description_html: cleanHtml(parsed.data.descriptionHtml),
      questions: q.questions,
    })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  await logAudit(service, {
    action: "vacancy.updated",
    entityType: "vacancy",
    entityId: id,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/vacancies");
  revalidatePath("/careers");
  revalidatePath(`/careers/${slug}`);
  return { success: true, message: "Saved" };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["open", "close"]),
});

export async function changeVacancyStatusAction(formData: FormData) {
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { error: "Invalid request" };

  const actor = await requireVacancyActor(PERMISSIONS.VACANCIES_PUBLISH);
  if ("error" in actor) return { error: actor.error };

  const service = createSupabaseServiceClient();
  const { data: vacancy } = await service
    .from("vacancies")
    .select("id, slug, status")
    .eq("id", parsed.data.id)
    .single();
  if (!vacancy) return { error: "Vacancy not found" };

  const update =
    parsed.data.action === "open"
      ? { status: "open", opened_at: new Date().toISOString(), closed_at: null }
      : { status: "closed", closed_at: new Date().toISOString() };

  const { error: updateError } = await service
    .from("vacancies")
    .update(update)
    .eq("id", parsed.data.id);
  if (updateError) return { error: updateError.message };

  await logAudit(service, {
    action: parsed.data.action === "open" ? "vacancy.opened" : "vacancy.closed",
    entityType: "vacancy",
    entityId: parsed.data.id,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/vacancies");
  revalidatePath("/careers");
  revalidatePath(`/careers/${vacancy.slug}`);
  return { success: true, message: "Status updated" };
}
