"use client";

import { useEffect, useRef, useState } from "react";
import {
  type PlacedField,
  type FieldKind,
  type SignerRole,
  type FillMode,
  FIELD_MIN_W,
  FIELD_MIN_H,
} from "@/lib/signatures/fields";

const PDFJS_VERSION = "6.1.200";

let fieldSeq = 0;
function newId() {
  fieldSeq += 1;
  return `f${Date.now().toString(36)}${fieldSeq}`;
}

interface Palette {
  kind: FieldKind;
  who: SignerRole;
  fill: FillMode;
  label: string;
  required: boolean;
}

const KIND_LABEL: Record<FieldKind, string> = {
  signature: "Signature",
  initials: "Initials",
  text: "Text",
  date: "Date",
};

/** Colour per field, so the placement is readable at a glance. */
function fieldColour(f: { kind: FieldKind; who: SignerRole; fill?: FillMode }) {
  if (f.kind === "signature" || f.kind === "initials") {
    return f.who === "employee"
      ? { border: "#14263f", bg: "rgba(20,38,63,0.10)", text: "#14263f" }
      : { border: "#A3852C", bg: "rgba(163,133,44,0.14)", text: "#7a6320" };
  }
  // text/date
  return f.fill === "sender"
    ? { border: "#2563eb", bg: "rgba(37,99,235,0.10)", text: "#1e40af" }
    : { border: "#059669", bg: "rgba(5,150,105,0.10)", text: "#065f46" };
}

function fieldCaption(f: PlacedField) {
  if (f.kind === "signature")
    return f.who === "employee" ? "Employee signs" : "Employer signs";
  if (f.kind === "initials")
    return f.who === "employee" ? "Employee initials" : "Employer initials";
  const base = f.label || (f.kind === "date" ? "Date" : "Text");
  if (f.fill === "sender") return `${base} (you fill)`;
  return `${base} (${f.who} fills)`;
}

/**
 * Renders the PDF and lets the requester place typed fields on it by
 * pressing and dragging (Acrobat-style). Fields are configured via the
 * palette before drawing. Emits PlacedField[] on save.
 */
export function FieldPlacement({
  documentUrl,
  action,
  showChecklist = true,
  saveLabel,
  initialFields = [],
}: {
  documentUrl: string;
  action: (
    fields: PlacedField[],
    checklistKey: string,
  ) => Promise<{ error?: string } | void>;
  showChecklist?: boolean;
  saveLabel?: string;
  initialFields?: PlacedField[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fields, setFields] = useState<PlacedField[]>(initialFields);
  const [checklistKey, setChecklistKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [palette, setPalette] = useState<Palette>({
    kind: "signature",
    who: "employee",
    fill: "sender",
    label: "",
    required: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({ url: documentUrl }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.3 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block w-full h-auto";
          const wrapper = document.createElement("div");
          wrapper.className =
            "relative mx-auto mb-4 max-w-2xl border border-grey-200 shadow-sm";
          wrapper.dataset.page = String(i - 1);
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          await page.render({
            canvas,
            canvasContext: canvas.getContext("2d")!,
            viewport,
          }).promise;
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("The document could not be rendered for placement.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  const draft = useRef<{ page: number; startX: number; startY: number } | null>(null);
  const [preview, setPreview] = useState<PlacedField | null>(null);

  function pagePos(e: React.PointerEvent) {
    const target = (e.target as HTMLElement).closest("[data-page]");
    if (!target || !(target instanceof HTMLElement)) return null;
    const rect = target.getBoundingClientRect();
    return {
      page: Number(target.dataset.page),
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }
  function draftRect(
    current: { x: number; y: number },
    d: { page: number; startX: number; startY: number },
  ): PlacedField {
    return {
      id: newId(),
      page: d.page,
      x: Math.min(d.startX, current.x),
      y: Math.min(d.startY, current.y),
      w: Math.abs(current.x - d.startX),
      h: Math.abs(current.y - d.startY),
      kind: palette.kind,
      who: palette.who,
      fill: palette.kind === "text" || palette.kind === "date" ? palette.fill : undefined,
      label:
        palette.kind === "text" || palette.kind === "date"
          ? palette.label || KIND_LABEL[palette.kind]
          : undefined,
      required:
        palette.kind === "text" || palette.kind === "date"
          ? palette.required
          : undefined,
    };
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-field-box]")) return;
    const pos = pagePos(e);
    if (!pos) return;
    e.preventDefault();
    draft.current = { page: pos.page, startX: pos.x, startY: pos.y };
    setPreview(null);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = draft.current;
    if (!d) return;
    const pos = pagePos(e);
    if (!pos || pos.page !== d.page) return;
    e.preventDefault();
    setPreview(draftRect(pos, d));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = draft.current;
    if (!d) return;
    draft.current = null;
    setPreview(null);
    const pos = pagePos(e);
    if (!pos || pos.page !== d.page) return;
    const rect = draftRect(pos, d);
    if (rect.w < FIELD_MIN_W || rect.h < FIELD_MIN_H) return;
    setFields((prev) => [...prev, rect]);
  }
  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function save() {
    if (fields.length === 0) {
      setError("Place at least one field first");
      return;
    }
    // Signer text/date fields need a label
    for (const f of fields) {
      if ((f.kind === "text" || f.kind === "date") && !f.label) {
        setError("Every text/date field needs a label");
        return;
      }
    }
    setSaving(true);
    setError(null);
    const result = await action(fields, checklistKey);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
    }
  }

  const isTextKind = palette.kind === "text" || palette.kind === "date";

  return (
    <div className="space-y-4">
      {/* Palette / controls */}
      <div className="sticky top-0 z-30 space-y-2 rounded border border-grey-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Field:</span>
          <div className="flex overflow-hidden rounded border border-grey-300">
            {(["signature", "initials", "text", "date"] as FieldKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPalette((p) => ({ ...p, kind: k }))}
                className={`px-3 py-1.5 text-sm ${palette.kind === k ? "bg-navy-900 text-white" : "bg-white"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* who fills/signs */}
          {(palette.kind === "signature" ||
            palette.kind === "initials" ||
            (isTextKind && palette.fill === "signer")) && (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-grey-600">
                {isTextKind ? "Filled by:" : "Signed by:"}
              </span>
              <select
                value={palette.who}
                onChange={(e) =>
                  setPalette((p) => ({ ...p, who: e.target.value as SignerRole }))
                }
                className="rounded border border-grey-300 px-2 py-1 text-sm"
              >
                <option value="employee">Employee</option>
                <option value="employer">Employer</option>
              </select>
            </label>
          )}

          {/* fill mode for text/date */}
          {isTextKind && (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-grey-600">Who fills:</span>
              <select
                value={palette.fill}
                onChange={(e) =>
                  setPalette((p) => ({ ...p, fill: e.target.value as FillMode }))
                }
                className="rounded border border-grey-300 px-2 py-1 text-sm"
              >
                <option value="sender">You (before sending)</option>
                <option value="signer">Signer (while signing)</option>
              </select>
            </label>
          )}

          {/* label + required for text/date */}
          {isTextKind && (
            <>
              <input
                type="text"
                value={palette.label}
                onChange={(e) =>
                  setPalette((p) => ({ ...p, label: e.target.value }))
                }
                placeholder={palette.kind === "date" ? "e.g. Date signed" : "e.g. Full name"}
                className="rounded border border-grey-300 px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-1.5 text-sm text-grey-600">
                <input
                  type="checkbox"
                  checked={palette.required}
                  onChange={(e) =>
                    setPalette((p) => ({ ...p, required: e.target.checked }))
                  }
                />
                Required
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-grey-100 pt-2">
          <span className="text-xs text-grey-500">
            Press and drag on the document to draw the field. Click a field to remove it.
          </span>
          {showChecklist && (
            <select
              value={checklistKey}
              onChange={(e) => setChecklistKey(e.target.value)}
              className="rounded border border-grey-300 px-2 py-1.5 text-sm"
            >
              <option value="">No checklist link</option>
              <option value="nda_signed">Ticks: NDA Signed &amp; Uploaded</option>
              <option value="contract_signed">Ticks: Contract Signed &amp; Uploaded</option>
            </select>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : `${saveLabel ?? "Create request"} (${fields.length} field${fields.length === 1 ? "" : "s"})`}
          </button>
          {error && <span className="text-sm text-red-800">{error}</span>}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-grey-500">
          <LegendDot colour="#14263f" label="Employee signature/initials" />
          <LegendDot colour="#A3852C" label="Employer signature/initials" />
          <LegendDot colour="#2563eb" label="You fill (before sending)" />
          <LegendDot colour="#059669" label="Signer fills" />
        </div>
      </div>

      {loading && <p className="text-sm text-grey-600">Rendering document…</p>}

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="cursor-crosshair touch-none select-none"
      />
      <FieldOverlays
        containerRef={containerRef}
        fields={preview ? [...fields, preview] : fields}
        onRemove={removeField}
      />
      {pageCount > 0 && <p className="text-xs text-grey-500">{pageCount} page(s)</p>}
    </div>
  );
}

function LegendDot({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: colour }}
      />
      {label}
    </span>
  );
}

function FieldOverlays({
  containerRef,
  fields,
  onRemove,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  fields: PlacedField[];
  onRemove: (id: string) => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll("[data-field-box]").forEach((el) => el.remove());

    fields.forEach((field) => {
      const wrapper = container.querySelector(`[data-page="${field.page}"]`);
      if (!wrapper || !(wrapper instanceof HTMLElement)) return;
      const colour = fieldColour(field);
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.fieldBox = "1";
      el.title = "Click to remove";
      el.style.position = "absolute";
      el.style.left = `${field.x * 100}%`;
      el.style.top = `${field.y * 100}%`;
      el.style.width = `${field.w * 100}%`;
      el.style.height = `${field.h * 100}%`;
      el.style.border = `2px dashed ${colour.border}`;
      el.style.backgroundColor = colour.bg;
      el.style.fontSize = "10px";
      el.style.color = colour.text;
      el.style.overflow = "hidden";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.textAlign = "center";
      el.textContent = fieldCaption(field);
      el.onclick = (e) => {
        e.stopPropagation();
        onRemove(field.id);
      };
      wrapper.appendChild(el);
    });
  }, [fields, containerRef, onRemove]);

  return null;
}
