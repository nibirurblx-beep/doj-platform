import { createSupabaseServiceClient } from "@/lib/db/server";
import { getDocAccess } from "@/lib/documents/access";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { NextResponse } from "next/server";

/** Streams an employee file to staff with employee-file access (used by the
 *  signature placement screen, which needs the original before any request
 *  exists). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  if (!name || name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("employee_number, organisations(slug)")
    .eq("id", id)
    .single();
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = (employee.organisations as unknown as { slug: string } | null)?.slug;
  const path = `employees/${slug}/${employee.employee_number}/${name}`;

  const access = await getDocAccess();
  if (!access.canAccess(path)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: blob, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);
  if (error || !blob) {
    return NextResponse.json({ error: "Could not load file" }, { status: 500 });
  }

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
