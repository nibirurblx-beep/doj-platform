"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { appendSignatureCertificate } from "@/lib/signatures/pdf";
import { CHECKLIST_ITEMS, type ChecklistState } from "@/lib/employees/checklist";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const MAX_SIGNATURE_BYTES = 300 * 1024;

export async function signDocumentAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const requestId = formData.get("requestId");
  const signature = formData.get("signature");
  if (typeof requestId !== "string" || typeof signature !== "string") {
    return { error: "Invalid input" };
  }
  if (!signature.startsWith("data:image/png;base64,")) {
    return { error: "Draw your signature before submitting" };
  }

  const base64 = signature.slice("data:image/png;base64,".length);
  const signatureBytes = Uint8Array.from(Buffer.from(base64, "base64"));
  if (signatureBytes.length < 500) {
    return { error: "Draw your signature before submitting" };
  }
  if (signatureBytes.length > MAX_SIGNATURE_BYTES) {
    return { error: "Signature image too large - try again" };
  }

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("signature_requests")
    .select(
      "id, user_id, employee_id, organisation_id, document_path, title, checklist_key, status, employees(employee_number, rank, checklist), organisations(name)",
    )
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found" };
  if (request.user_id !== user.id) return { error: "This request is not assigned to you" };
  if (request.status !== "pending") return { error: "This request is no longer open" };

  const employee = request.employees as unknown as {
    employee_number: string;
    rank: string | null;
    checklist: ChecklistState | null;
  } | null;
  const orgName =
    (request.organisations as unknown as { name: string } | null)?.name ?? "";

  const { data: profile } = await service
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Load the original PDF
  const { data: originalBlob, error: downloadError } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(request.document_path);
  if (downloadError || !originalBlob) {
    return { error: "The original document could not be loaded" };
  }

  const signedAtIso = new Date().toISOString();
  let signedPdf: Uint8Array;
  try {
    signedPdf = await appendSignatureCertificate(
      new Uint8Array(await originalBlob.arrayBuffer()),
      {
        signerName: profile?.display_name || user.email || "Staff member",
        employeeNumber: employee?.employee_number ?? "",
        rank: employee?.rank ?? null,
        organisationName: orgName,
        documentTitle: request.title,
        requestId: request.id,
        signaturePng: signatureBytes,
        signedAtIso,
      },
    );
  } catch (error) {
    console.error("PDF stamping failed:", error);
    return { error: "That document could not be processed as a PDF" };
  }

  // Store the signed copy next to the original
  const signedPath = request.document_path.replace(/\.pdf$/i, "") +
    ` (signed ${signedAtIso.slice(0, 10)}).pdf`;
  const { error: uploadError } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(signedPath, signedPdf.slice().buffer as ArrayBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) return { error: uploadError.message };

  const { error: updateError } = await service
    .from("signature_requests")
    .update({ status: "signed", signed_at: signedAtIso, signed_path: signedPath })
    .eq("id", request.id);
  if (updateError) return { error: updateError.message };

  // Auto-tick the linked checklist item
  if (
    request.checklist_key &&
    CHECKLIST_ITEMS.some((item) => item.key === request.checklist_key)
  ) {
    const checklist = (employee?.checklist ?? {}) as ChecklistState;
    checklist[request.checklist_key] = {
      done: true,
      by: user.id,
      at: signedAtIso,
    };
    await service
      .from("employees")
      .update({ checklist })
      .eq("id", request.employee_id);
  }

  await logAudit(service, {
    action: "signature.signed",
    entityType: "signature_requests",
    entityId: request.id,
    orgId: request.organisation_id,
    reason: request.title,
    actor: user.id,
  });

  revalidatePath(`/portal/sign/${request.id}`);
  revalidatePath(`/portal/employment/employees/${request.employee_id}`);
  revalidatePath("/portal");
  return { success: true };
}
