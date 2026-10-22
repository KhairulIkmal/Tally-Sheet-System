"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const KEY = "tally.paperZoom";
const MIN = 0.4;
const MAX = 1.6;

const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

function readZoom(): number {
  try {
    const z = Number(window.localStorage.getItem(KEY));
    return z ? clamp(z) : 1;
  } catch {
    return 1;
  }
}

/**
 * Zoom for the paper sheet only (the bars stay put): buttons, Fit to the
 * screen width, two-finger pinch on phones and Ctrl + wheel on computers.
 * The level is remembered on this device.
 */
export function usePaperZoom() {
  const [zoom, setZoomState] = useState(readZoom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
    try {
      window.localStorage.setItem(KEY, String(zoom));
    } catch {
      // Private mode: the zoom just isn't remembered.
    }
  }, [zoom]);

  const setZoom = useCallback((z: number) => setZoomState(clamp(z)), []);

  const fit = useCallback(() => {
    const scroller = scrollRef.current;
    const sheet = sheetRef.current;
    if (!scroller || !sheet) return;
    const natural = sheet.getBoundingClientRect().width / zoomRef.current;
    if (natural > 0) setZoom(Math.min(1, scroller.clientWidth / natural));
  }, [setZoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pinch: { dist: number; zoom: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { dist: dist(e.touches), zoom: zoomRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        setZoom(pinch.zoom * (dist(e.touches) / pinch.dist));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [setZoom]);

  return { zoom, setZoom, fit, scrollRef, sheetRef };
}

export function ZoomControls({ zoom, setZoom, fit }: { zoom: number; setZoom: (z: number) => void; fit: () => void }) {
  const btn = "grid size-10 place-items-center rounded-full text-ink hover:bg-canvas disabled:opacity-30";
  return (
    <div
      role="group"
      aria-label="Zoom the sheet"
      className="absolute right-3 bottom-3 z-20 flex items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-[0_6px_20px_rgba(16,24,40,.18)] backdrop-blur"
    >
      <button type="button" aria-label="Zoom out" className={btn} disabled={zoom <= MIN} onClick={() => setZoom(zoom - 0.1)}>
        <Minus className="size-[18px]" />
      </button>
      <button
        type="button"
        title="Back to 100%"
        aria-label={`Zoom ${Math.round(zoom * 100)}%, tap for 100%`}
        className="h-10 min-w-[54px] rounded-full px-1 text-sm font-extrabold tabular-nums hover:bg-canvas"
        onClick={() => setZoom(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" className={btn} disabled={zoom >= MAX} onClick={() => setZoom(zoom + 0.1)}>
        <Plus className="size-[18px]" />
      </button>
      <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
      <button type="button" className="h-10 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary-soft" onClick={fit}>
        Fit
      </button>
    </div>
  );
}
