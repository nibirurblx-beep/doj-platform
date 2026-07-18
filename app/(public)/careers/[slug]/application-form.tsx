"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitApplicationAction } from "./actions";

interface Question {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "yes_no" | "select";
  required: boolean;
  options?: string[];
}

export function ApplicationForm({
  vacancyId,
  questions,
}: {
  vacancyId: string;
  questions: Question[];
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return submitApplicationAction(formData);
    },
    null,
  );

  if (state && "success" in state && state.success) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-5">
        <h3 className="font-display text-lg text-green-800">
          Application submitted
        </h3>
        <p className="mt-2 text-sm text-green-800">
          Your reference number is{" "}
          <strong className="font-mono">{state.appNumber}</strong>. Keep it
          safe. You can track progress from your{" "}
          <Link href="/applicant" className="underline">
            applicant dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vacancyId" value={vacancyId} />

      {questions.map((q) => (
        <div key={q.id}>
          <label htmlFor={`q_${q.id}`} className="block text-sm font-medium">
            {q.label}
            {q.required && <span className="text-red-800"> *</span>}
          </label>

          {q.type === "short_text" && (
            <input
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              type="text"
              required={q.required}
              maxLength={300}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          )}

          {q.type === "long_text" && (
            <textarea
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              required={q.required}
              maxLength={5000}
              rows={5}
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            />
          )}

          {q.type === "yes_no" && (
            <select
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              required={q.required}
              defaultValue=""
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose…
              </option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          )}

          {q.type === "select" && (
            <select
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              required={q.required}
              defaultValue=""
              className="mt-1 w-full rounded border border-grey-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose…
              </option>
              {(q.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      {state && "error" in state && state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-navy-900 px-5 py-2.5 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
