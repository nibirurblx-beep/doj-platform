import { createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { NextResponse } from "next/server";

/** Streams a template's master PDF to managers for the field editor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const service = createSupabaseServiceClient();
  const { data: template } = await service
    .from("signature_templates")
    .select("document_path, organisation_id")
    .eq("id", id)
    .single();
  if (!template || !template.document_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, template.organisation_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: blob, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(template.document_path);
  if (error || !blob) {
    return NextResponse.json({ error: "Could not load file" }, { status: 500 });
  }
  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
