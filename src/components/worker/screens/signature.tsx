"use client";

import { useEffect, useRef, useState } from "react";
import { BottomBar, Button } from "../ui";

/**
 * Finger signature pad. Draws at device resolution for a smooth line, and
 * exports a 1× PNG (small enough to store with the sheet).
 */
export function SignatureScreen({
  summary,
  signerName,
  timeLabel,
  initial,
  onConfirm,
}: {
  summary: string;
  signerName: string;
  timeLabel: string;
  initial: string | null;
  onConfirm: (png: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(!!initial);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1b2a6e";
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = initial;
    }

    let down = false;
    const pos = (e: PointerEvent): [number, number] => {
      const b = el.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers refuse capture for pen hover; drawing still works.
      }
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasInk(true);
    };
    const onUp = () => {
      down = false;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onUp);
    };
    // Set up once; `initial` is only the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    const el = canvasRef.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.restore();
    setHasInk(false);
  };

  const confirm = () => {
    const el = canvasRef.current;
    if (!el || !hasInk) return;
    const out = document.createElement("canvas");
    out.width = el.offsetWidth;
    out.height = el.offsetHeight;
    out.getContext("2d")?.drawImage(el, 0, 0, out.width, out.height);
    onConfirm(out.toDataURL("image/png"));
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="text-base/[1.4] font-semibold text-body">{summary}</div>
        <div className="relative flex-1 overflow-hidden rounded-2xl border-2 border-field bg-white">
          <canvas ref={canvasRef} className="absolute inset-0 block size-full cursor-crosshair touch-none" aria-label="Signature pad" />
          {!hasInk ? (
            <div className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-lg font-semibold text-[#aeb4bd]">Sign here with your finger</div>
          ) : null}
          <div className="pointer-events-none absolute inset-x-6 bottom-[70px] border-b-2 border-dashed border-[#cfd4da]" />
          <span className="pointer-events-none absolute bottom-[78px] left-6 text-xl font-bold text-[#aeb4bd]">×</span>
          <div className="pointer-events-none absolute bottom-[22px] left-6 flex flex-col text-[#15181d]">
            <span className="text-[17px] font-bold uppercase">{signerName}</span>
            <span className="text-[13px] font-medium text-[#5b6270]">{timeLabel}</span>
          </div>
        </div>
      </div>
      <BottomBar className="grid grid-cols-[1fr_1.6fr] gap-2.5">
        <Button variant="secondary" className="text-[17px]" onClick={clear}>
          Clear
        </Button>
        <Button disabled={!hasInk} onClick={confirm}>
          Confirm
        </Button>
      </BottomBar>
    </>
  );
}
