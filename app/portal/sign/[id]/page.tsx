import { requireActiveUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { notFound, redirect } from "next/navigation";
import { SigningForm } from "./signing-form";
import {
  normaliseField,
  fieldsForStage,
  type PlacedField,
} from "@/lib/signatures/fields";

export const metadata = { title: "Sign document" };

export default async function SignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireActiveUser();
  const { id } = await params;

  const service = createSupabaseServiceClient();
  const { data: request } = await service
    .from("signature_requests")
    .select(
      "id, user_id, requested_by, title, status, boxes, organisations(name)",
    )
    .eq("id", id)
    .single();
  if (!request) notFound();

  const isEmployeeSigner = request.user_id === session.user.id;
  const isEmployerSigner = request.requested_by === session.user.id;
  if (!isEmployeeSigner && !isEmployerSigner) {
    redirect("/portal?denied=that signature request");
  }

  const orgName =
    (request.organisations as unknown as { name: string } | null)?.name ?? "";

  const myTurn =
    (request.status === "pending" && isEmployeeSigner) ||
    (request.status === "pending_employer" && isEmployerSigner);

  if (!myTurn) {
    const label =
      request.status === "complete" || request.status === "signed"
        ? "This document is fully signed."
        : request.status === "cancelled"
          ? "This signature request was cancelled."
          : request.status === "pending"
            ? "Waiting for the employee to complete their part first."
            : "Waiting for the employer to countersign.";
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-2xl">{request.title}</h1>
        <div className="rounded border border-grey-200 bg-white p-6">
          <p className="text-sm text-grey-700">{label}</p>
          {(request.status === "complete" || request.status === "signed") && (
            <a
              href={`/portal/sign/${request.id}/document?signed=1`}
              className="mt-3 inline-block rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
            >
              Download the signed copy
            </a>
          )}
        </div>
      </div>
    );
  }

  const stage = request.status === "pending" ? "employee" : "employer";
  const fields: PlacedField[] = ((request.boxes ?? []) as Record<string, unknown>[]).map(
    normaliseField,
  );
  const { signatures, inputs } = fieldsForStage(fields, stage);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl">Sign: {request.title}</h1>
        <p className="mt-1 text-sm text-grey-600">
          {stage === "employee"
            ? `Requested by ${orgName} leadership. Read the document, complete any fields, then sign below.`
            : "Employer countersignature: the employee has completed their part - review, complete any fields, and add your signature."}
        </p>
      </div>

      <div className="rounded border border-grey-200 bg-white p-2">
        <object
          data={`/portal/sign/${request.id}/document${stage === "employer" ? "?signed=1" : ""}`}
          type="application/pdf"
          className="h-[480px] w-full"
        >
          <p className="p-4 text-sm text-grey-700">
            Preview unavailable in this browser.{" "}
            <a
              href={`/portal/sign/${request.id}/document${stage === "employer" ? "?signed=1" : ""}`}
              className="text-navy-900 underline"
            >
              Open the document
            </a>{" "}
            before signing.
          </p>
        </object>
      </div>

      <div className="rounded border border-grey-200 bg-white p-6">
        {signatures.length > 0 && (
          <p className="mb-4 text-sm text-grey-600">
            Your signature will be placed in {signatures.length} marked
            position{signatures.length === 1 ? "" : "s"} on the document.
          </p>
        )}
        <SigningForm
          requestId={request.id}
          inputs={inputs}
          needsSignature={signatures.length > 0}
          defaultName={session.user.displayName ?? ""}
        />
      </div>
    </div>
  );
}
