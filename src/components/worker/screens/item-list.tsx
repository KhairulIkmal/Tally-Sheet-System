"use client";

import { useState } from "react";
import { ArrowUp, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { countStatus, formatQty, formatRange, itemQty, palletRanges, totals, type DraftItem } from "@/lib/tally/draft";
import { BottomBar, Button, Scroll } from "../ui";

const STATUS_TEXT = { none: "text-ink", ok: "text-success", short: "text-warning", over: "text-danger" } as const;

export function ItemListScreen({
  items,
  onEdit,
  onRename,
  onMoveUp,
  onDelete,
  onAdd,
  onDone,
  doneLabel = "Done · Materials",
}: {
  items: DraftItem[];
  onEdit: (i: number) => void;
  onRename: (i: number, name: string) => void;
  onMoveUp: (i: number) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onDone: () => void;
  doneLabel?: string;
}) {
  const t = totals(items);
  const ranges = palletRanges(items);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const saveName = (i: number) => {
    const name = renaming?.name.trim().toUpperCase() ?? "";
    if (name) onRename(i, name);
    setRenaming(null);
  };
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
            {/* Several units (446 CTN · 100 TIN) wrap at a smaller size instead of being cut off. */}
            <div className={cn("font-extrabold", Object.keys(t.qty).length > 1 ? "text-xl/tight" : "truncate text-[32px]")}>
              {formatQty(t.qty)}
            </div>
          </div>
        </div>
        {items.map((it, i) => {
          const status = countStatus(itemQty(it), it.targetQty, it.unit);
          const mixed = it.pallets.filter((p) => p.lines.length > 1).length;
          return (
            <div key={it.id} className="flex flex-none flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
              {renaming?.id === it.id ? (
                <input
                  autoFocus
                  value={renaming.name}
                  aria-label="Item name"
                  enterKeyHint="done"
                  className="h-11 w-full min-w-0 rounded-[9px] border-2 border-primary bg-surface px-3 text-[17px] font-bold uppercase outline-none"
                  onChange={(e) => setRenaming({ id: it.id, name: e.target.value.toUpperCase().slice(0, 80) })}
                  onBlur={() => saveName(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <div className="text-[17px] font-bold">
                  {it.name}
                  <button
                    type="button"
                    aria-label={`Rename ${it.name}`}
                    className="ml-1.5 inline-grid size-8 place-items-center rounded-md align-middle text-primary hover:bg-primary-soft"
                    onClick={() => setRenaming({ id: it.id, name: it.name })}
                  >
                    <Pencil className="size-[18px]" />
                  </button>
                </div>
              )}
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
          {doneLabel}
        </Button>
      </BottomBar>
    </>
  );
}
