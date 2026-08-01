"use client";

import { FieldPlacement } from "@/components/signatures/field-placement";
import type { PlacedField } from "@/lib/signatures/fields";

export function TemplateFieldEditor({
  documentUrl,
  existing,
  action,
}: {
  documentUrl: string;
  existing: PlacedField[];
  action: (fields: PlacedField[]) => Promise<{ error?: string; success?: boolean } | void>;
}) {
  return (
    <FieldPlacement
      documentUrl={documentUrl}
      initialFields={existing}
      showChecklist={false}
      saveLabel="Save template"
      action={async (fields) => action(fields)}
    />
  );
}
