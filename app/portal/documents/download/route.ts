import { getUserSession } from "@/lib/auth/session";
import { getDocAccess } from "@/lib/documents/access";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { DOCUMENTS_BUCKET, isSafePath } from "@/lib/documents/storage";
import { NextResponse, type NextRequest } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path || !isSafePath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Central access rules: staff-wide areas, department-private folders,
  // and protected employee files all resolve here.
  const access = await getDocAccess();
  if (!access.canAccess(path)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const service = createSupabaseServiceClient();
  const { data: blob, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);

  if (error || !blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = path.split("/").pop() ?? "download";

  await logAudit(service, {
    action: "document.downloaded",
    entityType: "storage_object",
    reason: path,
    actor: session.user.id,
  });

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
