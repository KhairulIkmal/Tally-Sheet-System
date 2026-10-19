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
      // Saved signatures are cropped to the ink: redraw centred, at most the pad's size.
      img.onload = () => {
        const k = Math.min(1, (w - 16) / img.width, (h - 16) / img.height);
        const iw = img.width * k;
        const ih = img.height * k;
        ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      };
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
    // Keep only the ink (plus a little margin), so the signature fills the line on the sheet.
    const box = inkBox(el);
    if (!box) return;
    const dpr = el.width / el.offsetWidth || 1;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(box.w / dpr));
    out.height = Math.max(1, Math.round(box.h / dpr));
    out.getContext("2d")?.drawImage(el, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
    onConfirm(out.toDataURL("image/png"));
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="text-base/[1.4] font-semibold text-body">{summary}</div>
        <div className="relative flex-1 overflow-hidden rounded-2xl border-2 border-field bg-white">
          <canvas ref={canvasRef} className="absolute inset-0 block size-full cursor-crosshair touch-none" aria-label="Signature pad" />
          {!hasInk ? (
            <div className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-lg font-semibold text-[#aeb4bd]">
              Sign here with your finger
            </div>
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

/** The bounding box of the drawn pixels, in canvas pixels, with a small margin. */
function inkBox(el: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  const { width, height } = el;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = Math.round(6 * (window.devicePixelRatio || 1));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(width, maxX + pad + 1) - x, h: Math.min(height, maxY + pad + 1) - y };
}
