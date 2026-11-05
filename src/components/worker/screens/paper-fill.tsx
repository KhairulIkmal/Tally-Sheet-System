"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { FillSpec } from "@/lib/tally/paper-rows";

export interface FillDrag {
  spec: FillSpec;
  /** First row being filled (the row the button was held on). */
  from: number;
  /** Row under the finger: the fill runs down to here. */
  to: number;
  /** What gets copied, for the hint. */
  value: string;
}

const same = (a: FillSpec, b: FillSpec) =>
  a.kind === b.kind && (a.kind !== "line" || (b.kind === "line" && a.field === b.field && a.li === b.li));

/**
 * Follows a held finger over the paper's rows (tr[data-row]) until it lets
 * go: on every move, on every frame (the sheet may be scrolling under a
 * still finger) and once more on release. The sheet scrolls near its top or
 * bottom edge. Rows are found by what is under the finger, so the paper
 * zoom doesn't matter. Downwards only unless `both`.
 * onDone gets the last row (null if cancelled) and whether the finger moved.
 */
function followRows(
  e: React.PointerEvent,
  scrollRef: React.RefObject<HTMLDivElement | null>,
  from: number,
  both: boolean,
  onTo: (to: number) => void,
  onDone: (to: number | null, moved: boolean) => void,
): () => void {
  const x = e.clientX;
  let y = e.clientY;
  let to = from;
  let moved = false;
  // Looks through anything floating over the sheet (the Done button, the hint) to the row beneath.
  const rowAt = (py: number) => {
    for (const el of document.elementsFromPoint(x, py)) {
      const tr = el.closest<HTMLElement>("tr[data-row]");
      if (tr) return Number(tr.dataset.row);
    }
    return null;
  };
  const track = () => {
    const n = rowAt(y);
    if (n === null) return;
    const next = both ? n : Math.max(from, n);
    if (next !== to) {
      to = next;
      onTo(to);
    }
  };
  let raf = 0;
  const tick = () => {
    const sc = scrollRef.current;
    if (sc) {
      const r = sc.getBoundingClientRect();
      // The keyboard may still be closing: the edge is where the finger can reach.
      const vv = window.visualViewport;
      const bottom = vv ? Math.min(r.bottom, vv.offsetTop + vv.height) : r.bottom;
      if (y > bottom - 56) sc.scrollTop += 14;
      else if (y < r.top + 40) sc.scrollTop -= 14;
    }
    track();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const onMove = (ev: PointerEvent) => {
    if (!moved && Math.abs(ev.clientY - e.clientY) > 6) {
      moved = true;
      // A drag needs the room: close the keyboard. A plain tap leaves it open to keep typing.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    y = ev.clientY;
    track();
  };
  const end = (apply: boolean) => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    onDone(apply ? to : null, moved);
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
  return () => end(false);
}

/**
 * The "same" button as a fill handle. A tap copies into its own row as before; holding it
 * and dragging down copies the same value into every row the finger
 * passes, like a spreadsheet.
 */
export function useFillDrag(scrollRef: React.RefObject<HTMLDivElement | null>, onFill: (from: number, to: number, spec: FillSpec) => void) {
  const [drag, setDrag] = useState<FillDrag | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = useCallback(
    (e: React.PointerEvent, spec: FillSpec, from: number, value: string, single: () => void) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      setDrag({ spec, from, to: from, value });
      stop.current = followRows(
        e,
        scrollRef,
        from,
        false,
        (to) => setDrag((d) => (d ? { ...d, to } : d)),
        (to, moved) => {
          stop.current = null;
          setDrag(null);
          if (to === null) return;
          if (to > from) onFill(from, to, spec);
          else if (!moved) single();
        },
      );
    },
    [scrollRef, onFill],
  );

  /** True when row i's cell for `spec` is inside the fill being dragged. */
  const covers = useCallback((spec: FillSpec, i: number) => !!drag && same(drag.spec, spec) && i >= drag.from && i <= drag.to, [drag]);

  return { drag, start, covers };
}

/** Outline on the cells a drag will fill. */
export const fillCell = "bg-primary-soft outline-2 -outline-offset-2 outline-dashed outline-primary";

/** The "same" button (as on the step-by-step view): tap to copy from the row above, hold and drag down to copy into more rows. */
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
        "flex h-9 w-8 flex-none cursor-grab touch-none flex-col items-center justify-center rounded-md text-[9px] leading-none font-bold text-primary select-none hover:bg-primary-soft active:cursor-grabbing " +
        (className ?? "mr-0.5")
      }
    >
      <ArrowUp aria-hidden className="size-3.5" strokeWidth={2.5} />
      same
    </button>
  );
}

/**
 * 🗑 the same way: a tap deletes its row as before; holding it and dragging
 * up or down marks every row the finger passes, and letting go deletes them
 * (after a confirm when any of them has something written).
 */
export function useDeleteDrag(scrollRef: React.RefObject<HTMLDivElement | null>, onDelete: (from: number, to: number) => void) {
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = useCallback(
    (e: React.PointerEvent, from: number, single: () => void) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      setRange({ from, to: from });
      stop.current = followRows(
        e,
        scrollRef,
        from,
        true,
        (to) => setRange({ from, to }),
        (to, moved) => {
          stop.current = null;
          setRange(null);
          if (to === null) return;
          if (to !== from) onDelete(from, to);
          else if (!moved) single();
        },
      );
    },
    [scrollRef, onDelete],
  );

  const lo = range ? Math.min(range.from, range.to) : -1;
  const hi = range ? Math.max(range.from, range.to) : -1;
  return { range: range ? { from: lo, to: hi } : null, start, covers: (i: number) => i >= lo && i <= hi };
}

/** A row marked for deletion while 🗑 is dragged. */
export const deleteRowMark = "[&>td]:bg-danger-bg! [&>td]:text-danger-ink [&_input]:line-through";
