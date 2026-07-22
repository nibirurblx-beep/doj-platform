"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import {
  stampSignatureIntoBoxes,
  appendCompletionCertificate,
  type SignatureBox,
} from "@/lib/signatures/pdf";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
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
  const signatureBytes = Uint8Array.from(
    Buffer.from(signature.slice("data:image/png;base64,".length), "base64"),
  );
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
      "id, user_id, requested_by, employee_id, organisation_id, document_path, signed_path, title, checklist_key, status, boxes, requested_at, signed_at, employees(employee_number, rank, checklist), organisations(name)",
    )
    .eq("id", requestId)
    .single();
  if (!request) return { error: "Request not found" };

  const boxes = (request.boxes ?? []) as SignatureBox[];
  const employee = request.employees as unknown as {
    employee_number: string;
    rank: string | null;
    checklist: ChecklistState | null;
  } | null;
  const orgName =
    (request.organisations as unknown as { name: string } | null)?.name ?? "";

  // Which stage is this, and is this user allowed to sign it?
  let stage: "employee" | "employer";
  if (request.status === "pending") {
    if (request.user_id !== user.id) {
      return { error: "This request is not assigned to you" };
    }
    stage = "employee";
  } else if (request.status === "pending_employer") {
    if (request.requested_by !== user.id) {
      return { error: "The employer signature is for the requester" };
    }
    if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, request.organisation_id))) {
      return { error: "You no longer have employer signing rights here" };
    }
    stage = "employer";
  } else {
    return { error: "This request is no longer open" };
  }

  // Load the current document (working copy if the employee already signed)
  const sourcePath =
    stage === "employer" && request.signed_path
      ? request.signed_path
      : request.document_path;
  const { data: blob, error: downloadError } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .download(sourcePath);
  if (downloadError || !blob) {
    return { error: "The document could not be loaded" };
  }

  const nowIso = new Date().toISOString();
  const myBoxes = boxes.filter((b) => b.signer === stage);

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = new Uint8Array(await blob.arrayBuffer());
    if (myBoxes.length > 0) {
      pdfBytes = await stampSignatureIntoBoxes(pdfBytes, signatureBytes, myBoxes);
    }
  } catch (error) {
    console.error("PDF stamping failed:", error);
    return { error: "That document could not be processed as a PDF" };
  }

  const employerBoxesExist = boxes.some((b) => b.signer === "employer");
  const isFinal = stage === "employer" || !employerBoxesExist;

  if (isFinal) {
    // Completion: certificate + final file + checklist + status
    const { data: employeeProfile } = await service
      .from("profiles")
      .select("display_name")
      .eq("id", request.user_id)
      .single();
    const { data: employerProfile } =
      stage === "employer"
        ? await service
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .single()
        : { data: null };

    try {
      pdfBytes = await appendCompletionCertificate(pdfBytes, {
        documentTitle: request.title,
        requestId: request.id,
        employeeName: employeeProfile?.display_name || "Staff member",
        employeeNumber: employee?.employee_number ?? "",
        organisationName: orgName,
        employeeSignedAtIso:
          stage === "employee" ? nowIso : (request.signed_at ?? null),
        employerName:
          stage === "employer"
            ? employerProfile?.display_name || user.email || "Employer"
            : null,
        employerSignedAtIso: stage === "employer" ? nowIso : null,
      });
    } catch (error) {
      console.error("Certificate failed:", error);
      return { error: "The certificate page could not be added" };
    }

    const finalPath =
      request.document_path.replace(/\.pdf$/i, "") +
      ` (signed ${nowIso.slice(0, 10)}).pdf`;
    const { error: uploadError } = await service.storage
      .from(DOCUMENTS_BUCKET)
      .upload(finalPath, pdfBytes.slice().buffer as ArrayBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) return { error: uploadError.message };

    // Remove the intermediate working copy
    if (request.signed_path && request.signed_path !== finalPath) {
      await service.storage.from(DOCUMENTS_BUCKET).remove([request.signed_path]);
    }

    const { error: updateError } = await service
      .from("signature_requests")
      .update({
        status: "complete",
        signed_path: finalPath,
        signed_at: stage === "employee" ? nowIso : request.signed_at,
        employer_signed_at: stage === "employer" ? nowIso : null,
      })
      .eq("id", request.id);
    if (updateError) return { error: updateError.message };

    if (
      request.checklist_key &&
      CHECKLIST_ITEMS.some((item) => item.key === request.checklist_key)
    ) {
      const checklist = (employee?.checklist ?? {}) as ChecklistState;
      checklist[request.checklist_key] = { done: true, by: user.id, at: nowIso };
      await service
        .from("employees")
        .update({ checklist })
        .eq("id", request.employee_id);
    }

    await logAudit(service, {
      action: stage === "employer" ? "signature.countersigned" : "signature.signed",
      entityType: "signature_requests",
      entityId: request.id,
      orgId: request.organisation_id,
      reason: `${request.title} (complete)`,
      actor: user.id,
    });
  } else {
    // Employee stage with employer boxes still to come: store working copy
    const workingPath =
      request.document_path.replace(/\.pdf$/i, "") + " (awaiting employer).pdf";
    const { error: uploadError } = await service.storage
      .from(DOCUMENTS_BUCKET)
      .upload(workingPath, pdfBytes.slice().buffer as ArrayBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) return { error: uploadError.message };

    const { error: updateError } = await service
      .from("signature_requests")
      .update({
        status: "pending_employer",
        signed_path: workingPath,
        signed_at: nowIso,
      })
      .eq("id", request.id);
    if (updateError) return { error: updateError.message };

    await logAudit(service, {
      action: "signature.signed",
      entityType: "signature_requests",
      entityId: request.id,
      orgId: request.organisation_id,
      reason: `${request.title} (awaiting employer)`,
      actor: user.id,
    });
  }

  revalidatePath(`/portal/sign/${request.id}`);
  revalidatePath(`/portal/employment/employees/${request.employee_id}`);
  revalidatePath("/portal");
  return { success: true };
}
