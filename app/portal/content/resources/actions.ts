"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const BUCKET = "public-media";
const PREFIX = "resources";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|odt|rtf|txt)$/i;

async function requireResourceManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  if (!(await hasPermissionAnywhere(PERMISSIONS.CONTENT_CREATE))) {
    return { error: "You do not have permission to manage public resources" as const };
  }
  return { userId: user.id };
}

export async function uploadPublicResourceAction(formData: FormData) {
  const actor = await requireResourceManager();
  if ("error" in actor) return { error: actor.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file first" };
  }
  if (file.size > MAX_BYTES) return { error: "File too large (10 MB max)" };
  const name = file.name.replace(/[/\\]/g, "").trim();
  if (!name || !ALLOWED_EXT.test(name)) {
    return { error: "Use a document format: PDF, DOC/DOCX, ODT, RTF or TXT" };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${PREFIX}/${name}`, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "resource.published",
    entityType: "storage_object",
    reason: name,
    actor: actor.userId,
  });
  revalidatePath("/portal/content/resources");
  revalidatePath("/reading-room/public-resources");
  return { success: true, message: `${name} published` };
}

export async function deletePublicResourceAction(formData: FormData) {
  const actor = await requireResourceManager();
  if ("error" in actor) return { error: actor.error };

  const name = formData.get("name");
  if (typeof name !== "string" || !name || name.includes("/") || name.includes("..")) {
    return { error: "Invalid file" };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(BUCKET)
    .remove([`${PREFIX}/${name}`]);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "resource.removed",
    entityType: "storage_object",
    reason: name,
    actor: actor.userId,
  });
  revalidatePath("/portal/content/resources");
  revalidatePath("/reading-room/public-resources");
  return { success: true, message: "Removed" };
}

/** Publish a resource link: a named URL that appears in the public list
 *  alongside downloadable files. Stored as a small .link file. */
export async function addResourceLinkAction(formData: FormData) {
  const actor = await requireResourceManager();
  if ("error" in actor) return { error: actor.error };

  const name = formData.get("name");
  const url = formData.get("url");
  if (typeof name !== "string" || !name.trim() || typeof url !== "string") {
    return { error: "A name and URL are required" };
  }
  const clean = name.replace(/[/\\]/g, "").trim().slice(0, 120);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That URL is not valid" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Only http(s) links are allowed" };
  }

  const service = createSupabaseServiceClient();
  const body = JSON.stringify({ url: parsed.toString() });
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${PREFIX}/${clean}.link`, new Blob([body], { type: "application/json" }), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "resource.link_published",
    entityType: "storage_object",
    reason: `${clean} -> ${parsed.toString()}`,
    actor: actor.userId,
  });
  revalidatePath("/portal/content/resources");
  revalidatePath("/reading-room/public-resources");
  return { success: true, message: `Link "${clean}" published` };
}
