"use client";

import { useState } from "react";
import { FieldPlacement } from "./field-placement";
import { senderFields, type PlacedField } from "@/lib/signatures/fields";

/**
 * Wraps field placement with a sender-fill step: if the requester placed any
 * "you fill" text/date fields, they complete those values before the request
 * is created, so the employee receives a partly-filled document.
 */
export function RequestBuilder({
  documentUrl,
  action,
  initialFields = [],
}: {
  documentUrl: string;
  action: (
    fields: PlacedField[],
    checklistKey: string,
  ) => Promise<{ error?: string } | void>;
  initialFields?: PlacedField[];
}) {
  const [pending, setPending] = useState<{
    fields: PlacedField[];
    checklistKey: string;
  } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Called by FieldPlacement on save. If there are sender fields, show the
  // fill step; otherwise submit straight away.
  async function handlePlaced(fields: PlacedField[], checklistKey: string) {
    const toFill = senderFields(fields);
    if (toFill.length === 0) {
      return action(fields, checklistKey);
    }
    setPending({ fields, checklistKey });
    // Return void: FieldPlacement stops its own saving state
  }

  async function submitWithValues() {
    if (!pending) return;
    // Validate required sender fields
    for (const f of senderFields(pending.fields)) {
      if (f.required && !values[f.id]?.trim()) {
        setError(`Please fill "${f.label}"`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    const merged = pending.fields.map((f) =>
      f.fill === "sender" ? { ...f, value: values[f.id] ?? "" } : f,
    );
    const result = await action(merged, pending.checklistKey);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  if (pending) {
    const toFill = senderFields(pending.fields);
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded border border-grey-200 bg-white p-6">
        <div>
          <h3 className="font-display text-lg">Fill in your details</h3>
          <p className="mt-1 text-sm text-grey-600">
            Complete the fields you chose to fill before sending. The rest are
            left for the signer.
          </p>
        </div>
        {toFill.map((f) => (
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
              className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
        {error && <p className="text-sm text-red-800">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submitWithValues}
            disabled={submitting}
            className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create request"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setError(null);
            }}
            className="px-3 text-sm text-grey-500 hover:text-grey-800"
          >
            Back to placement
          </button>
        </div>
      </div>
    );
  }

  return (
    <FieldPlacement
      documentUrl={documentUrl}
      action={handlePlaced}
      initialFields={initialFields}
    />
  );
}
