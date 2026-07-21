import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { NextResponse } from "next/server";

/**
 * Streams the document behind a signature request to its assigned signer.
 * This is the deliberate, narrow exception to employee-file folder rules:
 * the person asked to sign a document must be able to read it, and only it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const wantSigned = url.searchParams.get("signed") === "1";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();
  const { data: sigRequest } = await service
    .from("signature_requests")
    .select("id, user_id, status, document_path, signed_path, title")
    .eq("id", id)
    .single();
  if (!sigRequest || sigRequest.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sigRequest.status === "cancelled") {
    return NextResponse.json({ error: "Request cancelled" }, { status: 410 });
  }

  const path = wantSigned ? sigRequest.signed_path : sigRequest.document_path;
  if (!path) {
    return NextResponse.json({ error: "No document" }, { status: 404 });
  }

  const { data: blob, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);
  if (error || !blob) {
    return NextResponse.json({ error: "Could not load document" }, { status: 500 });
  }

  const filename = path.split("/").pop() ?? "document.pdf";
  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
