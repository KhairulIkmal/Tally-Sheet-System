"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { saveHistoryItemAction } from "@/lib/data/actions";
import type { HistoryItem } from "@/lib/data/types";
import { formatDateTime } from "@/lib/tally/dates";

interface Editing {
  id: string;
  name: string;
  unit: string;
  per: string;
  isActive: boolean;
}

const COLS = "1fr 90px 120px 90px 140px 100px 70px";

/**
 * Office: the item names workers have typed. Entries are added
 * automatically when a sheet is submitted; here the office fixes a typo,
 * changes the unit or qty per pallet, or hides an entry from suggestions.
 */
export function ItemHistoryManager({ items }: { items: HistoryItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();

  const shown = items.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    startTransition(async () => {
      const res = await saveHistoryItemAction({
        id: editing.id,
        name: editing.name.trim().toUpperCase(),
        unit: editing.unit.trim().toUpperCase() || "CTN",
        qtyPerPallet: editing.per.trim() ? parseInt(editing.per, 10) : null,
        isActive: editing.isActive,
      });
      if (!res.ok) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }

  const input = "h-11 rounded-lg border-[1.5px] border-field bg-surface px-3 text-[15px] font-semibold uppercase outline-none focus:border-primary";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <h1 className="text-[28px] font-extrabold">Item history</h1>
            <div className="text-[15px] font-medium text-muted">
              Every item name workers have submitted. They see these as suggestions while typing. Fix typos here, or hide an entry.
            </div>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items"
            aria-label="Search items"
            className="h-11 w-[260px] rounded-lg border border-field bg-surface px-3.5 text-[15px] font-medium outline-none focus:border-primary"
          />
        </div>

        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-4">
            <div className="text-lg font-bold">Edit item</div>
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">Name</span>
                <input autoFocus required maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">Unit</span>
                <input
                  maxLength={10}
                  value={editing.unit}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value.replace(/[^A-Za-z0-9 .]/g, "") })}
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">Qty per pallet</span>
                <input
                  inputMode="numeric"
                  value={editing.per}
                  onChange={(e) => setEditing({ ...editing, per: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  className={input}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-[15px] font-semibold">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-5" />
              Suggest to workers
            </label>
            {error ? (
              <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-ink">
                {error}
              </div>
            ) : null}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="h-11 rounded-lg bg-primary px-5 font-bold text-white disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-lg border-[1.5px] border-field px-5 font-bold">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div
            className="grid h-11 items-center border-b border-line bg-surface-sunken px-4 text-xs font-bold tracking-[.06em] text-muted"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>NAME</span>
            <span>UNIT</span>
            <span className="text-right">QTY / PALLET</span>
            <span className="text-right">USED</span>
            <span className="pl-6">LAST USED</span>
            <span>STATUS</span>
            <span />
          </div>
          {shown.map((p) => (
            <div
              key={p.id}
              className={cn("grid h-[50px] items-center border-b border-line-soft px-4 text-[15px] font-medium", !p.isActive && "text-faint")}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="truncate font-semibold">{p.name}</span>
              <span>{p.unit}</span>
              <span className="text-right">{p.qtyPerPallet ?? "—"}</span>
              <span className="text-right">{p.useCount}×</span>
              <span className="pl-6 text-sm text-muted">{formatDateTime(p.lastUsedAt) || "—"}</span>
              <span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", p.isActive ? "bg-success-bg text-success" : "bg-chip text-muted")}>
                  {p.isActive ? "Suggested" : "Hidden"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setEditing({ id: p.id, name: p.name, unit: p.unit, per: p.qtyPerPallet ? String(p.qtyPerPallet) : "", isActive: p.isActive });
                }}
                className="text-right text-sm font-bold text-primary"
              >
                Edit
              </button>
            </div>
          ))}
          {shown.length === 0 ? (
            <div className="px-4 py-10 text-center text-[15px] font-medium text-muted">
              {items.length ? "No matching items." : "No items yet. They appear here once workers submit sheets."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
