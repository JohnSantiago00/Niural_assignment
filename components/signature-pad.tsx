"use client";

/**
 * Lightweight drawn-signature pad. It stays isolated from offer workflow state
 * so signature UI changes cannot affect token validation or first-write signing
 * semantics.
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
      <p className="mb-3 text-sm font-semibold text-ink">Draw your signature</p>
      <div className="rounded-3xl border border-line/80 bg-white/85 p-3 shadow-sm">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-2xl bg-hero/70"
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
          className="rounded-full border border-line/80 bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
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
      <ol className="grid gap-2 text-sm text-slate-600">
        <li className="rounded-2xl bg-hero/70 px-4 py-3">1. Review the offer letter.</li>
        <li className="rounded-2xl bg-hero/70 px-4 py-3">2. Confirm your agreement.</li>
        <li className="rounded-2xl bg-hero/70 px-4 py-3">3. Draw your signature and sign.</li>
      </ol>
      <SignaturePadField onSignatureChange={setHasSignature} />
      <label className="flex gap-3 rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
        <input
          type="checkbox"
          name="agreement"
          className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
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
        className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
      >
        Sign Offer
      </button>
    </form>
  );
}
