"use server";

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

  await service.rpc("audit_log", {
    p_action: "document.uploaded",
    p_entity_type: "storage_object",
    p_reason: path,
    p_actor: actor.userId,
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

  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .remove([path]);
  if (error) return { error: error.message };

  await service.rpc("audit_log", {
    p_action: "document.deleted",
    p_entity_type: "storage_object",
    p_reason: path,
    p_actor: actor.userId,
  });

  revalidatePath("/portal/documents");
  return { success: true, message: "Deleted" };
}
