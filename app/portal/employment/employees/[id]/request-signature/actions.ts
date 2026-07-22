"use server";

import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/db/server";
import { userHasPermission } from "@/lib/permissions/server";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { CHECKLIST_ITEMS } from "@/lib/employees/checklist";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import type { PlacedBox } from "@/components/signatures/signature-placement";

const MAX_BOXES = 20;

export async function createPlacedSignatureRequestAction(
  employeeId: string,
  fileName: string,
  boxes: PlacedBox[],
  checklistKey: string,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (!Array.isArray(boxes) || boxes.length === 0 || boxes.length > MAX_BOXES) {
    return { error: "Place between 1 and 20 signature boxes" };
  }
  for (const box of boxes) {
    if (
      typeof box.page !== "number" ||
      box.page < 0 ||
      box.page > 500 ||
      [box.x, box.y, box.w, box.h].some(
        (n) => typeof n !== "number" || n < 0 || n > 1,
      ) ||
      (box.signer !== "employee" && box.signer !== "employer")
    ) {
      return { error: "Invalid box placement" };
    }
  }
  if (fileName.includes("/") || !fileName.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files can be sent for signature" };
  }

  const service = createSupabaseServiceClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, user_id, organisation_id, employee_number, organisations(slug)")
    .eq("id", employeeId)
    .single();
  if (!employee) return { error: "Employee not found" };

  if (!(await userHasPermission(PERMISSIONS.EMPLOYEES_UPDATE, employee.organisation_id))) {
    return { error: "You cannot manage employees in that organisation" };
  }

  const slug = (employee.organisations as unknown as { slug: string } | null)?.slug;
  const documentPath = `employees/${slug}/${employee.employee_number}/${fileName}`;

  const key = CHECKLIST_ITEMS.some((i) => i.key === checklistKey)
    ? checklistKey
    : null;

  const hasEmployeeBoxes = boxes.some((b) => b.signer === "employee");

  const { data: created, error } = await service
    .from("signature_requests")
    .insert({
      employee_id: employee.id,
      user_id: employee.user_id,
      organisation_id: employee.organisation_id,
      document_path: documentPath,
      title: fileName,
      checklist_key: key,
      boxes,
      status: hasEmployeeBoxes ? "pending" : "pending_employer",
      requested_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message || "Could not create request" };

  await logAudit(service, {
    action: "signature.requested",
    entityType: "signature_requests",
    entityId: created.id,
    orgId: employee.organisation_id,
    reason: `${fileName} (${boxes.length} boxes)`,
    actor: user.id,
  });

  redirect(`/portal/employment/employees/${employeeId}`);
}
