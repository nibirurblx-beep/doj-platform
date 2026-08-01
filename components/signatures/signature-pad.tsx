"use client";

import { useRef, useState, useEffect } from "react";
import { SIGNATURE_FONTS } from "@/lib/signatures/fields";

/**
 * Signature capture with two modes:
 *  - Draw: freehand canvas (mouse/touch)
 *  - Type: the signer types their name, rendered in a signature font they
 *    pick, then rasterised to a PNG.
 * Either way the output is a PNG data URL in a hidden field, so the server
 * side (stamping into boxes, certificate) is identical.
 */
export function SignaturePad({
  fieldName,
  defaultName = "",
}: {
  fieldName: string;
  defaultName?: string;
}) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [dataUrl, setDataUrl] = useState("");

  // ---- Draw mode ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  function ctx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (context) {
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#14263f";
    }
    return context;
  }
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const context = ctx();
    if (!context) return;
    drawing.current = true;
    const { x, y } = pos(e);
    context.beginPath();
    context.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const context = ctx();
    if (!context) return;
    const { x, y } = pos(e);
    context.lineTo(x, y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  }
  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInk) setDataUrl(canvas.toDataURL("image/png"));
  }
  function clearDraw() {
    const canvas = canvasRef.current;
    const context = ctx();
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setDataUrl("");
  }

  // ---- Type mode ----
  const [typed, setTyped] = useState(defaultName);
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0]?.id ?? "dancing");
  const typeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode !== "type") return;
    const canvas = typeCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const font = SIGNATURE_FONTS.find((f) => f.id === fontId) ?? SIGNATURE_FONTS[0];
    if (!font) return;

    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!typed.trim()) {
        setDataUrl("");
        return;
      }
      let size = 90;
      context.fillStyle = "#14263f";
      const family = font.css.replace(/'/g, "");
      do {
        context.font = `${size}px ${family}`;
        size -= 2;
      } while (context.measureText(typed).width > canvas.width - 40 && size > 20);
      context.textBaseline = "middle";
      context.textAlign = "center";
      context.fillText(typed, canvas.width / 2, canvas.height / 2);
      setDataUrl(canvas.toDataURL("image/png"));
    };

    const family = font.css.replace(/'/g, "");
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`90px ${family}`).then(render).catch(render);
    } else {
      render();
    }
  }, [mode, typed, fontId]);

  return (
    <div>
      <input type="hidden" name={fieldName} value={dataUrl} />

      <div className="mb-3 inline-flex overflow-hidden rounded border border-grey-300">
        <button
          type="button"
          onClick={() => {
            setMode("draw");
            setDataUrl("");
          }}
          className={`px-4 py-1.5 text-sm ${mode === "draw" ? "bg-navy-900 text-white" : "bg-white"}`}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => setMode("type")}
          className={`px-4 py-1.5 text-sm ${mode === "type" ? "bg-navy-900 text-white" : "bg-white"}`}
        >
          Type
        </button>
      </div>

      {mode === "draw" ? (
        <div>
          <canvas
            ref={canvasRef}
            width={560}
            height={200}
            onPointerDown={start}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full max-w-xl touch-none rounded border-2 border-dashed border-grey-300 bg-white"
            aria-label="Signature drawing area"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={clearDraw}
              className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900"
            >
              Clear
            </button>
            <p className="text-xs text-grey-500">
              Draw your signature above with your mouse or finger.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your full name"
            className="mb-2 w-full max-w-xl rounded border border-grey-300 px-3 py-2 text-sm"
          />
          <div className="mb-2 flex flex-wrap gap-2">
            {SIGNATURE_FONTS.map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => setFontId(font.id)}
                style={{ fontFamily: font.css }}
                className={`rounded border px-3 py-1.5 text-lg ${
                  fontId === font.id
                    ? "border-navy-900 bg-navy-50"
                    : "border-grey-300 bg-white"
                }`}
              >
                {typed.trim() || "Signature"}
              </button>
            ))}
          </div>
          <div className="max-w-xl rounded border-2 border-dashed border-grey-300 bg-white p-2">
            <canvas
              ref={typeCanvasRef}
              width={560}
              height={160}
              className="w-full"
              aria-label="Typed signature preview"
            />
          </div>
          <p className="mt-2 text-xs text-grey-500">
            Choose a style above. Your typed name becomes your signature.
          </p>
        </div>
      )}
    </div>
  );
}
