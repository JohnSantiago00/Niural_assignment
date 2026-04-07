"use client";

/**
 * Lightweight drawn-signature pad for Phase 05. We keep this isolated so a
 * future production signing vendor or richer signature-pad package can replace
 * it without changing offer workflow state.
 */
import { useEffect, useRef, useState } from "react";

function getPoint(canvas: HTMLCanvasElement, event: PointerEvent | React.PointerEvent) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function SignaturePadField({
  onSignatureChange
}: {
  onSignatureChange: (hasSignature: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const resizeCanvas = () => {
      const { width } = canvas.getBoundingClientRect();
      const height = 220;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2.5;
      context.strokeStyle = "#0f172a";
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  function updateSignatureData() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    setSignatureData(canvas.toDataURL("image/png"));
    onSignatureChange(true);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const point = getPoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
    setHasSignature(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const point = getPoint(canvas, event);
    context.lineTo(point.x, point.y);
    context.stroke();
    updateSignatureData();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    setIsDrawing(false);
    updateSignatureData();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData("");
    onSignatureChange(false);
  }

  return (
    <div>
      <div className="rounded-3xl border border-line bg-white p-3">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-2xl bg-panel"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Draw your signature"
        />
      </div>
      <input type="hidden" name="signatureImageData" value={signatureData} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {hasSignature ? "Signature captured." : "Use your mouse or finger to sign above."}
        </p>
        <button
          type="button"
          onClick={clearSignature}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          Clear signature
        </button>
      </div>
    </div>
  );
}

export function OfferSignatureForm({
  action
}: {
  action: (formData: FormData) => void;
}) {
  const [hasSignature, setHasSignature] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-5">
      <SignaturePadField onSignatureChange={setHasSignature} />
      <label className="flex gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-700">
        <input
          type="checkbox"
          name="agreement"
          className="mt-1"
          checked={hasAgreed}
          onChange={(event) => setHasAgreed(event.target.checked)}
        />
        <span>
          I have reviewed this offer letter and agree that my drawn signature
          indicates acceptance of the offer terms shown above.
        </span>
      </label>
      <button
        type="submit"
        disabled={!hasSignature || !hasAgreed}
        className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accentDark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Sign offer
      </button>
    </form>
  );
}
