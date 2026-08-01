"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signDocumentAction } from "../actions";
import { SignaturePad } from "@/components/signatures/signature-pad";
import type { PlacedField } from "@/lib/signatures/fields";

type ActionResult = { error?: string; success?: boolean } | null;

export function SigningForm({
  requestId,
  inputs,
  needsSignature,
  defaultName,
}: {
  requestId: string;
  inputs: PlacedField[];
  needsSignature: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      formData.set("fieldValues", JSON.stringify(values));
      const result = await signDocumentAction(formData);
      if (result?.success) router.refresh();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />

      {/* Signer-filled inputs */}
      {inputs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Fill in your details</h3>
          {inputs.map((f) => (
            <label key={f.id} className="block text-sm">
              <span className="mb-1 block font-medium">
                {f.label}
                {f.required && <span className="text-red-700"> *</span>}
              </span>
              <input
                type={f.kind === "date" ? "date" : "text"}
                value={values[f.id] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.id]: e.target.value }))
                }
                className="w-full max-w-md rounded border border-grey-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}

      {/* Signature */}
      {needsSignature && (
        <div>
          <h3 className="font-medium">Your signature</h3>
          <div className="mt-2">
            <SignaturePad fieldName="signature" defaultName={defaultName} />
          </div>
        </div>
      )}

      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Sign document"}
      </button>
      <p className="text-xs text-grey-500">
        By clicking Sign document you confirm the signature is yours and you
        agree to the document&rsquo;s contents.
      </p>
    </form>
  );
}
