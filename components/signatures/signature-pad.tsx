"use client";

import { useRef, useState } from "react";

/**
 * Drawable signature canvas. Mouse and touch. Emits a PNG data URL into a
 * hidden form field so a plain server action can receive it.
 */
export function SignaturePad({ fieldName }: { fieldName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [dataUrl, setDataUrl] = useState("");

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

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const context = ctx();
    if (!context) return;
    const { x, y } = pos(e);
    context.lineTo(x, y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInk) setDataUrl(canvas.toDataURL("image/png"));
    else if (canvas) setDataUrl(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = ctx();
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    setDataUrl("");
  }

  return (
    <div>
      <input type="hidden" name={fieldName} value={dataUrl} />
      <canvas
        ref={canvasRef}
        width={560}
        height={200}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full max-w-xl touch-none rounded border-2 border-dashed border-grey-300 bg-white"
        aria-label="Signature drawing area"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={clear}
          className="rounded border border-grey-300 bg-white px-3 py-1.5 text-sm hover:border-navy-900"
        >
          Clear
        </button>
        <p className="text-xs text-grey-500">
          Draw your signature above with your mouse or finger.
        </p>
      </div>
    </div>
  );
}
