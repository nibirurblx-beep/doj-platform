import { getUserSession } from "@/lib/auth/session";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { DOCUMENTS_BUCKET, isSafePath } from "@/lib/documents/storage";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  if (!(await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path || !isSafePath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data: blob, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);

  if (error || !blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = path.split("/").pop() ?? "download";

  await service.rpc("audit_log", {
    p_action: "document.downloaded",
    p_entity_type: "storage_object",
    p_reason: path,
    p_actor: session.user.id,
  });

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
