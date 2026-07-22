"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface PlacedBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  signer: "employee" | "employer";
}

const PDFJS_VERSION = "6.1.200";
const BOX_W = 0.28; // normalised default box size
const BOX_H = 0.05;

/**
 * Renders the PDF with pdf.js and lets the requester click to place
 * signature boxes, each tagged Employee or Employer. Coordinates are
 * stored normalised (0-1, top-left origin) so the server can map them
 * onto true PDF points regardless of screen size.
 */
export function SignaturePlacement({
  documentUrl,
  action,
}: {
  documentUrl: string;
  action: (boxes: PlacedBox[], checklistKey: string) => Promise<{ error?: string } | void>;
  }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [boxes, setBoxes] = useState<PlacedBox[]>([]);
  const [signer, setSigner] = useState<"employee" | "employer">("employee");
  const [checklistKey, setChecklistKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
          const viewport = page.getViewport({ scale: 1.2 });
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

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest("[data-page]");
    if (!target || !(target instanceof HTMLElement)) return;
    const pageIndex = Number(target.dataset.page);
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - BOX_W / 2;
    const y = (e.clientY - rect.top) / rect.height - BOX_H / 2;
    setBoxes((prev) => [
      ...prev,
      {
        page: pageIndex,
        x: Math.min(Math.max(x, 0), 1 - BOX_W),
        y: Math.min(Math.max(y, 0), 1 - BOX_H),
        w: BOX_W,
        h: BOX_H,
        signer,
      },
    ]);
  }

  function removeBox(index: number) {
    setBoxes((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (boxes.length === 0) {
      setError("Place at least one signature box first");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await action(boxes, checklistKey);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="sticky top-0 z-30 rounded border border-grey-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Placing:</span>
          <div className="flex overflow-hidden rounded border border-grey-300">
            <button
              type="button"
              onClick={() => setSigner("employee")}
              className={`px-3 py-1.5 text-sm ${signer === "employee" ? "bg-navy-900 text-white" : "bg-white"}`}
            >
              Employee signature
            </button>
            <button
              type="button"
              onClick={() => setSigner("employer")}
              className={`px-3 py-1.5 text-sm ${signer === "employer" ? "bg-gold-600 text-navy-950" : "bg-white"}`}
            >
              Employer signature
            </button>
          </div>
          <span className="text-xs text-grey-500">
            Click the document where each signature belongs. Click a box to remove it.
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={checklistKey}
            onChange={(e) => setChecklistKey(e.target.value)}
            className="rounded border border-grey-300 px-2 py-1.5 text-sm"
          >
            <option value="">No checklist link</option>
            <option value="nda_signed">Ticks: NDA Signed &amp; Uploaded</option>
            <option value="contract_signed">Ticks: Contract Signed &amp; Uploaded</option>
          </select>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? "Creating…" : `Create request (${boxes.length} box${boxes.length === 1 ? "" : "es"})`}
          </button>
          {error && <span className="text-sm text-red-800">{error}</span>}
        </div>
      </div>

      {loading && <p className="text-sm text-grey-600">Rendering document…</p>}

      {/* Pages + overlay boxes */}
      <div ref={containerRef} onClick={handleClick} className="cursor-crosshair" />
      <BoxOverlays containerRef={containerRef} boxes={boxes} onRemove={removeBox} />
      {pageCount > 0 && (
        <p className="text-xs text-grey-500">{pageCount} page(s)</p>
      )}
    </div>
  );
}

/** Draws the placed boxes over the rendered pages. */
function BoxOverlays({
  containerRef,
  boxes,
  onRemove,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  boxes: PlacedBox[];
  onRemove: (index: number) => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    // re-render overlays when boxes change or on resize
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // clear previous overlays
    container.querySelectorAll("[data-sig-box]").forEach((el) => el.remove());

    boxes.forEach((box, index) => {
      const wrapper = container.querySelector(`[data-page="${box.page}"]`);
      if (!wrapper || !(wrapper instanceof HTMLElement)) return;
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.sigBox = "1";
      el.title = "Click to remove";
      el.style.position = "absolute";
      el.style.left = `${box.x * 100}%`;
      el.style.top = `${box.y * 100}%`;
      el.style.width = `${box.w * 100}%`;
      el.style.height = `${box.h * 100}%`;
      el.style.border = `2px dashed ${box.signer === "employee" ? "#14263f" : "#A3852C"}`;
      el.style.backgroundColor =
        box.signer === "employee" ? "rgba(20,38,63,0.08)" : "rgba(163,133,44,0.12)";
      el.style.fontSize = "10px";
      el.style.color = box.signer === "employee" ? "#14263f" : "#7a6320";
      el.textContent = box.signer === "employee" ? "Employee signs" : "Employer signs";
      el.onclick = (e) => {
        e.stopPropagation();
        onRemove(index);
      };
      wrapper.appendChild(el);
    });
  }, [boxes, containerRef, onRemove]);

  return null;
}
