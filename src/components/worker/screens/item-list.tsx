"use client";

import { ArrowUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { countStatus, formatQty, formatRange, itemQty, palletRanges, totals, type DraftItem } from "@/lib/tally/draft";
import { BottomBar, Button, Scroll } from "../ui";

const STATUS_TEXT = { none: "text-ink", ok: "text-success", short: "text-warning", over: "text-danger" } as const;

export function ItemListScreen({
  items,
  onEdit,
  onMoveUp,
  onDelete,
  onAdd,
  onDone,
}: {
  items: DraftItem[];
  onEdit: (i: number) => void;
  onMoveUp: (i: number) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onDone: () => void;
}) {
  const t = totals(items);
  const ranges = palletRanges(items);
  return (
    <>
      <Scroll className="gap-2.5 p-4">
        <div className="grid flex-none grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="text-[13px] font-semibold text-muted">Pallets</div>
            <div className="text-[32px] font-extrabold">{t.pallets}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="text-[13px] font-semibold text-muted">Total qty</div>
            <div className="truncate text-[32px] font-extrabold">{formatQty(t.qty)}</div>
          </div>
        </div>
        {items.map((it, i) => {
          const status = countStatus(itemQty(it), it.targetQty, it.unit);
          const mixed = it.pallets.filter((p) => p.lines.length > 1).length;
          return (
            <div key={it.id} className="flex flex-none flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
              <div className="text-[17px] font-bold">{it.name}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 items-center rounded-md bg-solid px-2.5 font-condensed text-[15px] font-bold tracking-[.02em] text-on-solid uppercase">
                  {formatRange(ranges[i])}
                </span>
                <span className="text-sm font-semibold text-muted">
                  {it.pallets.length} pallet{it.pallets.length === 1 ? "" : "s"}
                  {mixed ? ` · ${mixed} mixed` : ""}
                </span>
              </div>
              <div className={cn("text-lg font-extrabold", STATUS_TEXT[status.state])}>{status.label}</div>
              <div className="grid grid-cols-[1fr_56px_56px] gap-1.5">
                <Button variant="soft" className="h-12 text-[15px]" onClick={() => onEdit(i)}>
                  Edit pallets
                </Button>
                <Button variant="secondary" className="h-12" aria-label="Move up" disabled={i === 0} onClick={() => onMoveUp(i)}>
                  <ArrowUp className="size-5" />
                </Button>
                <Button
                  variant="danger"
                  className="h-12 text-[13px]"
                  onClick={() => {
                    if (window.confirm(`Delete ${it.name} and its ${it.pallets.length} pallets?`)) onDelete(i);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        <Button variant="dashed" size="lg" className="flex-none rounded-[14px] text-lg" onClick={onAdd}>
          <Plus className="size-6" /> Add item
        </Button>
        <div className="text-center text-[13px] font-medium text-faint">The next item starts at Pallet {t.pallets + 1}</div>
      </Scroll>
      <BottomBar>
        <Button className="w-full" disabled={items.length === 0} onClick={onDone}>
          Done · Materials
        </Button>
      </BottomBar>
    </>
  );
}
