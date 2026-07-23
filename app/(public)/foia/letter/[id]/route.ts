import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { generateFoiLetter } from "@/lib/foi/letter";
import { NextResponse } from "next/server";

const DECIDED = ["completed", "denied", "appeal_completed", "appeal_denied"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("foi_requests")
    .select("*, organisations(name)")
    .eq("id", id)
    .single();
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = request.user_id === user.id;
  const isProcessor = await userHasPermission(
    PERMISSIONS.EMPLOYEES_DEPARTMENT_VIEW,
    request.organisation_id,
  );
  if (!isRequester && !isProcessor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!DECIDED.includes(request.status)) {
    return NextResponse.json({ error: "No decision yet" }, { status: 409 });
  }

  const { data: profile } = await service
    .from("profiles")
    .select("display_name")
    .eq("id", request.user_id)
    .single();

  const pdf = await generateFoiLetter({
    reference: request.reference,
    status: request.status,
    requesterName: profile?.display_name || "Requester",
    organisationName:
      (request.organisations as unknown as { name: string } | null)?.name ?? "",
    description: request.description,
    submittedAtIso: request.submitted_at,
    decidedAtIso: request.decided_at,
    decisionNote: request.decision_note,
    denialExemptions: request.denial_exemptions,
    appealNote: request.appeal_note,
  });

  return new NextResponse(pdf.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${request.reference} decision.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
