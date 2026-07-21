import { requireActiveUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/db/server";
import { notFound, redirect } from "next/navigation";
import { SignaturePad } from "@/components/signatures/signature-pad";
import { SignForm } from "./sign-form";

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
      "id, user_id, title, status, requested_at, signed_at, organisations(name)",
    )
    .eq("id", id)
    .single();
  if (!request) notFound();

  // Only the assigned signer may open this page
  if (request.user_id !== session.user.id) {
    redirect("/portal?denied=that signature request");
  }

  const orgName =
    (request.organisations as unknown as { name: string } | null)?.name ?? "";

  if (request.status !== "pending") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-2xl">{request.title}</h1>
        <div className="rounded border border-grey-200 bg-white p-6">
          <p className="text-sm text-grey-700">
            {request.status === "signed"
              ? "You have already signed this document."
              : "This signature request was cancelled."}
          </p>
          {request.status === "signed" && (
            <a
              href={`/portal/sign/${request.id}/document?signed=1`}
              className="mt-3 inline-block rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800"
            >
              Download your signed copy
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl">Sign: {request.title}</h1>
        <p className="mt-1 text-sm text-grey-600">
          Requested by {orgName} leadership. Read the document, then sign
          below.
        </p>
      </div>

      {/* Document preview */}
      <div className="rounded border border-grey-200 bg-white p-2">
        <object
          data={`/portal/sign/${request.id}/document`}
          type="application/pdf"
          className="h-[480px] w-full"
        >
          <p className="p-4 text-sm text-grey-700">
            Preview unavailable in this browser.{" "}
            <a
              href={`/portal/sign/${request.id}/document`}
              className="text-navy-900 underline"
            >
              Open the document
            </a>{" "}
            before signing.
          </p>
        </object>
      </div>

      {/* Signature */}
      <div className="rounded border border-grey-200 bg-white p-6">
        <h2 className="font-medium">Your signature</h2>
        <p className="mt-1 text-sm text-grey-600">
          A signature certificate page with your name, employee number and
          the date will be added to the document. It applies regardless of
          any unsigned placeholder lines in the body.
        </p>
        <div className="mt-4">
          <SignForm requestId={request.id}>
            <SignaturePad fieldName="signature" />
          </SignForm>
        </div>
      </div>
    </div>
  );
}
