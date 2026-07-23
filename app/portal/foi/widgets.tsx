"use client";

import { useActionState, useState } from "react";
import {
  foiReceiptAction,
  foiLateNoticeAction,
  foiCompleteAction,
  foiDenyAction,
} from "./actions";
import { FOI_EXEMPTIONS } from "@/lib/foi/constants";

type ActionResult = { error?: string; success?: boolean; message?: string } | null;

export function FoiControls({
  requestId,
  status,
  maxExtendedDate,
}: {
  requestId: string;
  status: string;
  maxExtendedDate: string; // yyyy-mm-dd
}) {
  const [mode, setMode] = useState<
    "idle" | "receipt" | "late" | "complete" | "deny"
  >("idle");

  const isAppeal = status === "appealed";

  if (mode === "idle") {
    return (
      <div className="flex flex-wrap gap-2">
        {status === "submitted" && (
          <button
            type="button"
            onClick={() => setMode("receipt")}
            className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-navy-900"
          >
            Issue receipt
          </button>
        )}
        {["submitted", "acknowledged"].includes(status) && (
          <button
            type="button"
            onClick={() => setMode("late")}
            className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-navy-900"
          >
            Late notice
          </button>
        )}
        {["submitted", "acknowledged", "late_notice", "appealed"].includes(status) && (
          <>
            <button
              type="button"
              onClick={() => setMode("complete")}
              className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-green-700 hover:text-green-700"
            >
              {isAppeal ? "Grant appeal" : "Complete"}
            </button>
            <button
              type="button"
              onClick={() => setMode("deny")}
              className="rounded border border-grey-300 px-3 py-1.5 text-sm hover:border-red-800 hover:text-red-800"
            >
              {isAppeal ? "Deny appeal" : "Deny"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border border-grey-200 bg-grey-050 p-3">
      {mode === "receipt" && (
        <ReceiptForm requestId={requestId} onClose={() => setMode("idle")} />
      )}
      {mode === "late" && (
        <LateForm
          requestId={requestId}
          maxExtendedDate={maxExtendedDate}
          onClose={() => setMode("idle")}
        />
      )}
      {mode === "complete" && (
        <CompleteForm
          requestId={requestId}
          isAppeal={isAppeal}
          onClose={() => setMode("idle")}
        />
      )}
      {mode === "deny" && (
        <DenyForm
          requestId={requestId}
          isAppeal={isAppeal}
          onClose={() => setMode("idle")}
        />
      )}
    </div>
  );
}

function Feedback({ state }: { state: ActionResult }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.message}
      </p>
    );
  }
  return null;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="px-2 text-sm text-grey-500 hover:text-grey-800"
    >
      Close
    </button>
  );
}

function ReceiptForm({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => foiReceiptAction(formData),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm font-medium">Receipt (due within 3 days)</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="compliant" value="yes" defaultChecked /> Properly
        submitted — include a processing time estimate below
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="compliant" value="no" /> Not compliant — explain
        the issue and how to remedy it
      </label>
      <textarea
        name="note"
        required
        rows={3}
        placeholder="Plain-English receipt for the requester…"
        className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
      />
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-navy-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "…" : "Issue receipt"}
        </button>
        <CloseButton onClose={onClose} />
      </div>
    </form>
  );
}

function LateForm({
  requestId,
  maxExtendedDate,
  onClose,
}: {
  requestId: string;
  maxExtendedDate: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => foiLateNoticeAction(formData),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm font-medium">
        Late notice — only for genuine circumstances preventing on-time
        processing; false reasons are prohibited
      </p>
      <label className="block text-sm">
        New decision date (max {maxExtendedDate})
        <input
          type="date"
          name="extendedDue"
          required
          max={maxExtendedDate}
          className="mt-1 block rounded border border-grey-300 px-3 py-1.5 text-sm"
        />
      </label>
      <textarea
        name="reason"
        required
        rows={3}
        placeholder="Reasons for the delay (included in the notice)…"
        className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
      />
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-navy-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "…" : "Issue late notice"}
        </button>
        <CloseButton onClose={onClose} />
      </div>
    </form>
  );
}

function CompleteForm({
  requestId,
  isAppeal,
  onClose,
}: {
  requestId: string;
  isAppeal: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => foiCompleteAction(formData),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm font-medium">
        {isAppeal ? "Grant the appeal" : "Complete the request"}
      </p>
      <textarea
        name="note"
        required
        rows={5}
        placeholder="Provide the requested information, or state exactly where it is located. If parts were withheld under an exemption, note that here too…"
        className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
      />
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "…" : isAppeal ? "Grant appeal" : "Complete"}
        </button>
        <CloseButton onClose={onClose} />
      </div>
    </form>
  );
}

function DenyForm({
  requestId,
  isAppeal,
  onClose,
}: {
  requestId: string;
  isAppeal: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => foiDenyAction(formData),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm font-medium">
        {isAppeal ? "Deny the appeal" : "Deny the request"}
      </p>
      {!isAppeal && (
        <>
          <p className="text-xs text-grey-600">
            Cite every exemption relied on. Redaction of exempt material must
            be attempted before denying a request in whole.
          </p>
          <div className="space-y-1">
            {FOI_EXEMPTIONS.map((ex) => (
              <label key={ex.key} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  name="exemptions"
                  value={ex.key}
                  className="mt-0.5"
                />
                <span>
                  ({ex.key}) {ex.label}
                </span>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs font-medium">
            <input type="checkbox" name="redactionConfirmed" className="mt-0.5" />
            <span>
              Every reasonable redaction attempt was made before denying the
              request in whole
            </span>
          </label>
        </>
      )}
      <textarea
        name="note"
        required
        rows={4}
        placeholder={
          isAppeal
            ? "Explain why the appeal is denied. The requester may pursue the matter in the United States District Court…"
            : "Specific reasons for the denial, and how the requester may appeal…"
        }
        className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
      />
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-red-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "…" : isAppeal ? "Deny appeal" : "Deny"}
        </button>
        <CloseButton onClose={onClose} />
      </div>
    </form>
  );
}
