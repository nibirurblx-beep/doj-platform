import { getUserSession } from "@/lib/auth/session";
import { hasPermissionAnywhere } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { createSupabaseServiceClient } from "@/lib/db/server";
import {
  isDriveConfigured,
  getItem,
  isWithinRoot,
  downloadFile,
  exportAsPdf,
  isGoogleNative,
} from "@/lib/google/drive";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  // Authenticate + authorise exactly like the browser page
  const session = await getUserSession();
  if (!session || session.isSuspended) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  if (!(await hasPermissionAnywhere(PERMISSIONS.DOCUMENTS_INTERNAL_VIEW))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "Drive not configured" }, { status: 503 });
  }

  const { fileId } = await params;

  // Basic ID hygiene, then containment check against the repository root
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }
  if (!(await isWithinRoot(fileId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let item;
  try {
    item = await getItem(fileId);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item.isFolder) {
    return NextResponse.json({ error: "Cannot download a folder" }, { status: 400 });
  }

  try {
    const native = isGoogleNative(item.mimeType);
    const stream = native
      ? await exportAsPdf(fileId)
      : await downloadFile(fileId);

    const filename = native ? `${item.name}.pdf` : item.name;
    const contentType = native ? "application/pdf" : item.mimeType;

    // Audit the download (actor passed explicitly: service-role call)
    const service = createSupabaseServiceClient();
    await service.rpc("audit_log", {
      p_action: "document.downloaded",
      p_entity_type: "drive_file",
      p_reason: filename,
      p_actor: session.user.id,
    });

    const body = Readable.toWeb(
      stream as unknown as Readable,
    ) as ReadableStream;

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Drive download failed:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }
}
