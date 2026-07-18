"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

// ----------------------------------------------------------------------------
// Sanitisation: the editor produces HTML on the client, which is untrusted.
// Only this allow-list survives into the database.
// ----------------------------------------------------------------------------
function cleanHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "p", "br", "hr",
      "strong", "em", "u", "s", "code", "pre", "blockquote",
      "ul", "ol", "li", "a",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
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

const contentSchema = z.object({
  type: z.enum(["news", "page"]),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().max(80).optional().or(z.literal("")),
  excerpt: z.string().max(500).optional().or(z.literal("")),
  bodyHtml: z.string().max(200_000, "Content too long"),
});

interface ActorCheck {
  userId: string;
  error?: never;
}
interface ActorError {
  userId?: never;
  error: string;
}

async function requireContentActor(
  permission: string,
): Promise<ActorCheck | ActorError> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Content permissions are held per-organisation; posting is platform-wide,
  // so holding the permission anywhere suffices.
  if (!(await hasPermissionAnywhere(permission))) {
    return { error: "You do not have permission to do this" };
  }
  return { userId: user.id };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export async function createContentAction(formData: FormData) {
  const parsed = contentSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    bodyHtml: formData.get("bodyHtml") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const actor = await requireContentActor(PERMISSIONS.CONTENT_CREATE);
  if (actor.error) return { error: actor.error };

  const input = parsed.data;
  const slug = input.slug ? slugify(input.slug) : slugify(input.title);
  if (!slug) return { error: "Could not derive a slug from the title" };

  const service = createSupabaseServiceClient();

  const { data: existing } = await service
    .from("content_posts")
    .select("id")
    .eq("type", input.type)
    .eq("slug", slug)
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: `A ${input.type} item with slug "${slug}" already exists` };
  }

  const { data: post, error: insertError } = await service
    .from("content_posts")
    .insert({
      type: input.type,
      slug,
      title: input.title,
      excerpt: input.excerpt || null,
      body_html: cleanHtml(input.bodyHtml),
      status: "draft",
      author_id: actor.userId,
    })
    .select("id")
    .single();

  if (insertError || !post) {
    return { error: insertError?.message || "Failed to create" };
  }

  await service.rpc("audit_log", {
    p_action: "content.created",
    p_entity_type: "content_post",
    p_entity_id: post.id,
  });

  revalidatePath("/portal/admin/content");
  redirect(`/portal/admin/content/${post.id}`);
}

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export async function updateContentAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing id" };

  const parsed = contentSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    slug: formData.get("slug") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    bodyHtml: formData.get("bodyHtml") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }

  const actor = await requireContentActor(PERMISSIONS.CONTENT_EDIT);
  if (actor.error) return { error: actor.error };

  const input = parsed.data;
  const slug = input.slug ? slugify(input.slug) : slugify(input.title);

  const service = createSupabaseServiceClient();

  const { data: current } = await service
    .from("content_posts")
    .select("id, type, slug, status")
    .eq("id", id)
    .single();
  if (!current) return { error: "Not found" };

  // Slug collision check when the slug changes
  if (slug !== current.slug) {
    const { data: clash } = await service
      .from("content_posts")
      .select("id")
      .eq("type", current.type)
      .eq("slug", slug)
      .neq("id", id)
      .limit(1);
    if (clash && clash.length > 0) {
      return { error: `A ${current.type} item with slug "${slug}" already exists` };
    }
  }

  const { error: updateError } = await service
    .from("content_posts")
    .update({
      title: input.title,
      slug,
      excerpt: input.excerpt || null,
      body_html: cleanHtml(input.bodyHtml),
    })
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  await service.rpc("audit_log", {
    p_action: "content.updated",
    p_entity_type: "content_post",
    p_entity_id: id,
  });

  revalidatePath("/portal/admin/content");
  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath(`/p/${slug}`);
  return { success: true, message: "Saved" };
}

// ----------------------------------------------------------------------------
// Status transitions
// ----------------------------------------------------------------------------
const statusActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["submit_review", "publish", "unpublish", "archive"]),
});

export async function changeContentStatusAction(formData: FormData) {
  const parsed = statusActionSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { error: "Invalid request" };

  const { id, action } = parsed.data;

  const permissionNeeded =
    action === "submit_review"
      ? PERMISSIONS.CONTENT_SUBMIT
      : action === "archive"
        ? PERMISSIONS.CONTENT_ARCHIVE
        : PERMISSIONS.CONTENT_PUBLISH;

  const actor = await requireContentActor(permissionNeeded);
  if (actor.error) return { error: actor.error };

  const service = createSupabaseServiceClient();
  const { data: post } = await service
    .from("content_posts")
    .select("id, slug, status")
    .eq("id", id)
    .single();
  if (!post) return { error: "Not found" };

  let update: Record<string, unknown>;
  let auditAction: string;

  switch (action) {
    case "submit_review":
      if (post.status !== "draft") return { error: "Only drafts can be submitted for review" };
      update = { status: "review" };
      auditAction = "content.submitted";
      break;
    case "publish":
      update = { status: "published", published_at: new Date().toISOString() };
      auditAction = "content.published";
      break;
    case "unpublish":
      if (post.status !== "published") return { error: "Not published" };
      update = { status: "draft" };
      auditAction = "content.unpublished";
      break;
    case "archive":
      update = { status: "archived" };
      auditAction = "content.archived";
      break;
  }

  const { error: updateError } = await service
    .from("content_posts")
    .update(update)
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  await service.rpc("audit_log", {
    p_action: auditAction,
    p_entity_type: "content_post",
    p_entity_id: id,
  });

  revalidatePath("/portal/admin/content");
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath(`/news/${post.slug}`);
  revalidatePath(`/p/${post.slug}`);
  return { success: true, message: "Status updated" };
}
