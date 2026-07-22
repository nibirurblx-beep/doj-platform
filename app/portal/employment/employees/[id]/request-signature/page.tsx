import { createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { notFound, redirect } from "next/navigation";
import { SignaturePlacement } from "@/components/signatures/signature-placement";
import { createPlacedSignatureRequestAction } from "./actions";
import type { PlacedBox } from "@/components/signatures/signature-placement";

export const metadata = { title: "Place signatures" };

export default async function RequestSignaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { id } = await params;
  const { file } = await searchParams;
  if (!file || file.includes("/") || !file.toLowerCase().endsWith(".pdf")) {
    notFound();
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, organisation_id, employee_number, user_id")
    .eq("id", id)
    .single();
  if (!employee) notFound();

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    redirect("/portal?denied=signature requests");
  }

  async function create(boxes: PlacedBox[], checklistKey: string) {
    "use server";
    return createPlacedSignatureRequestAction(id, file!, boxes, checklistKey);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Place signatures: {file}</h2>
        <p className="mt-1 text-sm text-grey-600">
          For {employee.employee_number}. The employee signs first; employer
          boxes are signed by you afterwards. A certificate page recording
          both signers is added when complete.
        </p>
      </div>
      <SignaturePlacement
        documentUrl={`/portal/employment/employees/${id}/file?name=${encodeURIComponent(file)}`}
        action={create}
      />
    </div>
  );
}
