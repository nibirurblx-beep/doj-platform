"use server";

import { logAudit } from "@/lib/audit";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import {
  DOCUMENTS_BUCKET,
  FOLDER_PLACEHOLDER,
  isSafePath,
  isSafeFileName,
} from "@/lib/documents/storage";
import { revalidatePath } from "next/cache";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // matches the bucket limit

async function requireDocumentActor(permission: string) {
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

export async function uploadDocumentAction(formData: FormData) {
  const actor = await requireDocumentActor(PERMISSIONS.DOCUMENTS_CREATE);
  if ("error" in actor) return { error: actor.error };

  const folder = formData.get("folder");
  const file = formData.get("file");

  if (typeof folder !== "string" || !isSafePath(folder)) {
    return { error: "Invalid folder" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File too large (20 MB maximum)" };
  }
  if (!isSafeFileName(file.name)) {
    return {
      error:
        "File name can only use letters, numbers, spaces, dots, dashes, brackets and underscores",
    };
  }

  // The actor must be able to access the target folder (stops cross-
  // department writes into private folders via crafted requests)
  const { getDocAccess: getUploadAccess } = await import("@/lib/documents/access");
  const uploadAccess = await getUploadAccess();
  if (!uploadAccess.canAccess(folder ? `${folder}/x` : "x")) {
    return { error: "You do not have access to that folder" };
  }

  const path = folder ? `${folder}/${file.name}` : file.name;
  const service = createSupabaseServiceClient();

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("exists")) {
      return { error: "A file with that name already exists here" };
    }
    return { error: uploadError.message };
  }

  await logAudit(service, {
    action: "document.uploaded",
    entityType: "storage_object",
    reason: path,
    actor: actor.userId,
  });

  revalidatePath("/portal/documents");
  return { success: true, message: `Uploaded ${file.name}` };
}

export async function createFolderAction(formData: FormData) {
  const actor = await requireDocumentActor(PERMISSIONS.DOCUMENTS_CREATE);
  if ("error" in actor) return { error: actor.error };

  const parent = formData.get("folder");
  const name = formData.get("name");

  if (typeof parent !== "string" || !isSafePath(parent)) {
    return { error: "Invalid folder" };
  }
  if (typeof name !== "string" || !isSafeFileName(name)) {
    return { error: "Folder name can only use letters, numbers, spaces, dots and dashes" };
  }

  const { getDocAccess: getCreateAccess } = await import("@/lib/documents/access");
  const createAccess = await getCreateAccess();
  if (!createAccess.canAccess(parent ? `${parent}/x` : "x")) {
    return { error: "You do not have access to that folder" };
  }

  const path = parent
    ? `${parent}/${name}/${FOLDER_PLACEHOLDER}`
    : `${name}/${FOLDER_PLACEHOLDER}`;

  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, new Uint8Array(0), {
      contentType: "application/octet-stream",
      upsert: true,
    });
  if (error) return { error: error.message };

  revalidatePath("/portal/documents");
  return { success: true, message: `Created folder ${name}` };
}

export async function deleteDocumentAction(formData: FormData) {
  const actor = await requireDocumentActor(PERMISSIONS.DOCUMENTS_ARCHIVE);
  if ("error" in actor) return { error: actor.error };

  const path = formData.get("path");
  if (typeof path !== "string" || !path || !isSafePath(path)) {
    return { error: "Invalid path" };
  }

  const { getDocAccess: getDeleteAccess } = await import("@/lib/documents/access");
  const deleteAccess = await getDeleteAccess();
  if (!deleteAccess.canAccess(path)) {
    return { error: "You do not have access to that file" };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .remove([path]);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "document.deleted",
    entityType: "storage_object",
    reason: path,
    actor: actor.userId,
  });

  revalidatePath("/portal/documents");
  return { success: true, message: "Deleted" };
}

export async function deleteFolderAction(formData: FormData) {
  const actor = await requireDocumentActor(PERMISSIONS.DOCUMENTS_ARCHIVE);
  if ("error" in actor) return { error: actor.error };

  const path = formData.get("path");
  if (typeof path !== "string" || !path || !isSafePath(path)) {
    return { error: "Invalid path" };
  }

  const { getDocAccess: getFolderAccess } = await import("@/lib/documents/access");
  const folderAccess = await getFolderAccess();
  if (!folderAccess.canAccess(`${path}/x`)) {
    return { error: "You do not have access to that folder" };
  }

  const service = createSupabaseServiceClient();

  // Only empty folders can be deleted: anything besides the placeholder blocks it
  const { data: entries, error: listErr } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .list(path, { limit: 3 });
  if (listErr) return { error: listErr.message };
  const contents = (entries ?? []).filter((e) => e.name !== FOLDER_PLACEHOLDER);
  if (contents.length > 0) {
    return { error: "Folder is not empty. Delete its contents first." };
  }

  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .remove([`${path}/${FOLDER_PLACEHOLDER}`]);
  if (error) return { error: error.message };

  await logAuditFolder(service, path, actor.userId);

  revalidatePath("/portal/documents");
  return { success: true, message: "Folder deleted" };
}

async function logAuditFolder(
  service: ReturnType<typeof createSupabaseServiceClient>,
  path: string,
  actorId: string,
) {
  const { logAudit } = await import("@/lib/audit");
  await logAudit(service, {
    action: "document.folder.deleted",
    entityType: "storage_object",
    reason: path,
    actor: actorId,
  });
}

/**
 * Enable/disable folder privacy. orgId = private to that organisation,
 * empty = visible to all staff. Works on any folder at any level.
 */
export async function setFolderVisibilityAction(formData: FormData) {
  const actor = await requireDocumentActor(PERMISSIONS.DOCUMENTS_CREATE);
  if ("error" in actor) return { error: actor.error };

  const path = formData.get("path");
  const orgId = formData.get("orgId");
  if (
    typeof path !== "string" ||
    !path ||
    !isSafePath(path) ||
    typeof orgId !== "string"
  ) {
    return { error: "Invalid input" };
  }

  const { getDocAccess, EMPLOYEE_FILES_ROOT } = await import("@/lib/documents/access");
  if (path.split("/")[0]?.toLowerCase() === EMPLOYEE_FILES_ROOT) {
    return { error: "Employee files have fixed protection" };
  }

  const access = await getDocAccess();
  if (!access.canAccess(`${path}/x`)) {
    return { error: "You do not have access to that folder" };
  }
  if (orgId && !access.assignableOrgs.some((o) => o.id === orgId)) {
    return { error: "You cannot restrict folders to that organisation" };
  }

  const service = createSupabaseServiceClient();

  if (orgId) {
    const { error } = await service.from("document_folder_rules").upsert({
      path,
      organisation_id: orgId,
      updated_by: actor.userId,
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await service
      .from("document_folder_rules")
      .delete()
      .eq("path", path);
    if (error) return { error: error.message };
  }

  const { logAudit } = await import("@/lib/audit");
  await logAudit(service, {
    action: orgId ? "document.folder.restricted" : "document.folder.opened",
    entityType: "storage_object",
    orgId: orgId || null,
    reason: path,
    actor: actor.userId,
  });

  revalidatePath("/portal/documents");
  return { success: true, message: orgId ? "Folder is now private" : "Folder visible to all staff" };
}
