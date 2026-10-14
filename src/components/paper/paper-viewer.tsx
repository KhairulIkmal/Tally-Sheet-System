"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { pageCount, type PaperData } from "@/lib/tally/sheet";
import { PAPER_HEIGHT, PAPER_WIDTH, PaperSheet } from "./paper-sheet";

/**
 * A scrollable, zoomable view of the A4 sheet. Starts fitted to the
 * available width; + / − zoom in steps. Used for the worker's preview and
 * the office detail page.
 */
export function PaperViewer({
  data,
  variant = "phone",
  maxFit = 1,
}: {
  data: PaperData;
  variant?: "phone" | "desk";
  maxFit?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.45);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const pages = pageCount(data.rows.length);
  const current = Math.min(page, pages);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setFit(Math.min(maxFit, Math.max(0.2, (el.clientWidth - 40) / PAPER_WIDTH)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxFit]);

  const scale = fit * zoom;
  const dark = variant === "phone" ? "bg-[#3a3f47]" : "bg-[#5b6270]";

  return (
    <div className={`relative min-h-0 flex-1 ${dark}`}>
      <div ref={boxRef} className="absolute inset-0 overflow-auto">
        <div style={{ width: Math.round(PAPER_WIDTH * scale), height: Math.round(PAPER_HEIGHT * scale) }} className="relative mx-auto my-5">
          <div
            className="absolute top-0 left-0 shadow-[0_10px_30px_rgba(0,0,0,.4)]"
            style={{ width: PAPER_WIDTH, height: PAPER_HEIGHT, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          >
            <PaperSheet data={data} page={current} />
          </div>
        </div>
      </div>

      <div className="absolute right-3 bottom-3.5 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          className="grid size-12 place-items-center rounded-xl bg-white text-[#15181d] shadow-[0_2px_8px_rgba(0,0,0,.25)]"
        >
          <Plus className="size-6" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          className="grid size-12 place-items-center rounded-xl bg-white text-[#15181d] shadow-[0_2px_8px_rgba(0,0,0,.25)]"
        >
          <Minus className="size-6" />
        </button>
      </div>

      <div className="absolute bottom-3.5 left-3 flex items-center gap-1.5">
        <span className="flex h-9 items-center rounded-full bg-black/70 px-3 text-[13px] font-semibold text-white">
          {zoom === 1 ? "Fit to width" : `Zoom ${Math.round(zoom * 100)}%`}
        </span>
        {pages > 1 ? (
          <button
            type="button"
            onClick={() => setPage(current >= pages ? 1 : current + 1)}
            className="flex h-9 items-center rounded-full bg-white px-3 text-[13px] font-bold text-[#15181d]"
          >
            Page {current} / {pages} →
          </button>
        ) : null}
      </div>
    </div>
  );
}
