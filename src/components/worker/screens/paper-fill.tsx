"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FillSpec } from "@/lib/tally/paper-rows";

export interface FillDrag {
  spec: FillSpec;
  /** First row being filled (the row the 〃 was held on). */
  from: number;
  /** Row under the finger: the fill runs down to here. */
  to: number;
  /** What gets copied, for the hint. */
  value: string;
}

const same = (a: FillSpec, b: FillSpec) =>
  a.kind === b.kind && (a.kind !== "line" || (b.kind === "line" && a.field === b.field && a.li === b.li));

/**
 * 〃 as a fill handle. A tap copies into its own row as before; holding it
 * and dragging down copies the same value into every row the finger
 * passes, like a spreadsheet. The sheet scrolls when the finger nears its
 * top or bottom edge, and rows are found by what is under the finger, so
 * the paper zoom doesn't matter.
 */
export function useFillDrag(scrollRef: React.RefObject<HTMLDivElement | null>, onFill: (from: number, to: number, spec: FillSpec) => void) {
  const [drag, setDrag] = useState<FillDrag | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = useCallback(
    (e: React.PointerEvent, spec: FillSpec, from: number, value: string, single: () => void) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      const x = e.clientX;
      let y = e.clientY;
      let to = from;
      let moved = false;
      setDrag({ spec, from, to, value });

      const rowAt = (py: number) => {
        const tr = document.elementFromPoint(x, py)?.closest<HTMLElement>("tr[data-row]");
        return tr ? Number(tr.dataset.row) : null;
      };
      // Follows the finger: on every move, on every frame (the sheet may be
      // scrolling under a still finger) and once more on release.
      const track = () => {
        const n = rowAt(y);
        if (n === null) return;
        const next = Math.max(from, n);
        if (next !== to) {
          to = next;
          setDrag((d) => (d ? { ...d, to } : d));
        }
      };
      let raf = 0;
      const tick = () => {
        const sc = scrollRef.current;
        if (sc) {
          const r = sc.getBoundingClientRect();
          if (y > r.bottom - 56) sc.scrollTop += 14;
          else if (y < r.top + 40) sc.scrollTop -= 14;
        }
        track();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const onMove = (ev: PointerEvent) => {
        if (Math.abs(ev.clientY - e.clientY) > 6) moved = true;
        y = ev.clientY;
        track();
      };
      const end = (apply: boolean) => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        stop.current = null;
        setDrag(null);
        if (!apply) return;
        if (to > from) onFill(from, to, spec);
        else if (!moved) single();
      };
      const onUp = (ev: PointerEvent) => {
        y = ev.clientY;
        track();
        end(true);
      };
      const onCancel = () => end(false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      stop.current = () => end(false);
    },
    [scrollRef, onFill],
  );

  /** True when row i's cell for `spec` is inside the fill being dragged. */
  const covers = useCallback((spec: FillSpec, i: number) => !!drag && same(drag.spec, spec) && i >= drag.from && i <= drag.to, [drag]);

  return { drag, start, covers };
}

/** Outline on the cells a drag will fill. */
export const fillCell = "bg-primary-soft outline-2 -outline-offset-2 outline-dashed outline-primary";

/** The 〃 button: tap to copy from the row above, hold and drag down to copy into more rows. */
export function DittoHandle({
  what,
  value,
  pallet,
  onStart,
  onCopy,
  className,
}: {
  what: string;
  value: string;
  pallet: number;
  onStart: (e: React.PointerEvent) => void;
  onCopy: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={`Copy ${what} from the row above: ${value}. Hold and drag down to copy into more rows.`}
      aria-label={`Pallet ${pallet}: copy ${what} from the row above (${value})`}
      onPointerDown={onStart}
      // Taps are handled on pointer up (so a drag doesn't also copy once); keyboard presses come here.
      onClick={(e) => e.detail === 0 && onCopy()}
      className={
        "grid h-9 w-8 flex-none cursor-grab touch-none place-items-center rounded-md text-lg font-extrabold text-primary select-none hover:bg-primary-soft active:cursor-grabbing " +
        (className ?? "mr-0.5")
      }
    >
      〃
    </button>
  );
}
