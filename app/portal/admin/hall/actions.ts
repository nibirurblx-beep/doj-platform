"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const PHOTO_BUCKET = "public-media";
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function requireHallManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const };
  if (!(await hasPermissionAnywhere(PERMISSIONS.USERS_MANAGE))) {
    return { error: "You do not have permission to manage the hall" as const };
  }
  return { userId: user.id };
}

const agSchema = z.object({
  ordinal: z.coerce.number().int().min(1).max(500),
  name: z.string().min(2).max(120),
  termStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Term start date required"),
  termEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
});

export async function saveAttorneyGeneralAction(formData: FormData) {
  const actor = await requireHallManager();
  if ("error" in actor) return { error: actor.error };

  const id = formData.get("id"); // empty = create
  const parsed = agSchema.safeParse({
    ordinal: formData.get("ordinal"),
    name: formData.get("name"),
    termStart: formData.get("termStart"),
    termEnd: formData.get("termEnd") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors)[0]?.[0] || "Invalid input" };
  }
  const input = parsed.data;
  if (input.termEnd && input.termEnd < input.termStart) {
    return { error: "Term end cannot be before term start" };
  }

  const service = createSupabaseServiceClient();
  const row = {
    ordinal: input.ordinal,
    name: input.name.trim(),
    term_start: input.termStart,
    term_end: input.termEnd || null,
    bio: input.bio?.trim() || null,
  };

  let agId: string;
  if (typeof id === "string" && id) {
    const { error } = await service
      .from("attorney_generals")
      .update(row)
      .eq("id", id);
    if (error) return { error: dupMessage(error.message) };
    agId = id;
  } else {
    const { data: created, error } = await service
      .from("attorney_generals")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) return { error: dupMessage(error?.message) };
    agId = created.id;
  }

  // Optional photo alongside the save
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return { error: "Saved, but the photo must be JPG, PNG or WebP" };
    if (photo.size > PHOTO_MAX_BYTES) {
      return { error: "Saved, but the photo is too large (2 MB max)" };
    }
    const path = `hall/${agId}.${ext}`;
    const { error: uploadError } = await service.storage
      .from(PHOTO_BUCKET)
      .upload(path, await photo.arrayBuffer(), {
        contentType: photo.type,
        upsert: true,
      });
    if (uploadError) return { error: `Saved, but photo failed: ${uploadError.message}` };
    const { data: pub } = service.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    await service
      .from("attorney_generals")
      .update({ photo_url: `${pub.publicUrl}?v=${Date.now()}` })
      .eq("id", agId);
  }

  await logAudit(service, {
    action: typeof id === "string" && id ? "hall.ag_updated" : "hall.ag_created",
    entityType: "attorney_generals",
    entityId: agId,
    reason: `${input.ordinal}: ${input.name.trim()}`,
    actor: actor.userId,
  });

  revalidatePath("/portal/admin/hall");
  revalidatePath("/hall-of-attorney-generals");
  return { success: true, message: "Saved" };
}

function dupMessage(message?: string) {
  if (message?.includes("duplicate") && message.includes("ordinal")) {
    return "That ordinal (e.g. 3rd) is already taken";
  }
  return message || "Could not save";
}

export async function deleteAttorneyGeneralAction(formData: FormData) {
  const actor = await requireHallManager();
  if ("error" in actor) return { error: actor.error };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Invalid input" };

  const service = createSupabaseServiceClient();
  const { data: ag } = await service
    .from("attorney_generals")
    .select("name")
    .eq("id", id)
    .single();

  for (const ext of ["jpg", "png", "webp"]) {
    await service.storage.from(PHOTO_BUCKET).remove([`hall/${id}.${ext}`]);
  }
  const { error } = await service.from("attorney_generals").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(service, {
    action: "hall.ag_deleted",
    entityType: "attorney_generals",
    entityId: id,
    reason: ag?.name ?? null,
    actor: actor.userId,
  });
  revalidatePath("/portal/admin/hall");
  revalidatePath("/hall-of-attorney-generals");
  return { success: true, message: "Removed" };
}
