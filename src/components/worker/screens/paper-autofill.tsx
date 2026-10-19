"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLT_TYPE_NAMES, PLT_TYPES, QUICK_UNITS, normalizeUnit, type PltType, type SheetForm } from "@/lib/tally/constants";
import { buildPallets, newId, splitIntoPallets, type DraftItem } from "@/lib/tally/draft";
import type { ItemSuggestion } from "../pick";
import { Button } from "../ui";

const field =
  "h-12 w-full min-w-0 rounded-[9px] border-[1.5px] border-field bg-surface px-3 text-lg font-bold uppercase outline-none focus:border-2 focus:border-primary";

/**
 * The step-by-step pallet calculator on the paper view: type the item, the
 * total and the qty on a full pallet, and the rows are filled in
 * (150 at 32 → 32, 32, 32, 32, 22).
 */
export function AutoFillPanel({
  form,
  history,
  nextStart,
  defaults,
  onAdd,
  onClose,
}: {
  form: SheetForm;
  history: ItemSuggestion[];
  /** Pallet number the first new row gets. */
  nextStart: number;
  defaults: { pltType: PltType; contractNo: string };
  onAdd: (item: DraftItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("CTN");
  const [total, setTotal] = useState("");
  const [per, setPer] = useState("");
  const [pltType, setPltType] = useState<PltType>(defaults.pltType);
  const [contractNo, setContractNo] = useState(defaults.contractNo);

  const qtys = useMemo(() => splitIntoPallets(parseInt(total, 10) || 0, parseInt(per, 10) || 0), [total, per]);
  const ready = !!name.trim() && qtys.length > 0;
  const end = nextStart + qtys.length - 1;

  function add() {
    if (!ready) return;
    const t = parseInt(total, 10) || 0;
    onAdd({
      id: newId(),
      name: name.trim().toUpperCase(),
      unit: normalizeUnit(unit),
      targetQty: t > 0 ? t : null,
      qtyPerPallet: parseInt(per, 10) || null,
      pallets: buildPallets(qtys, { pltType, contractNo: contractNo.trim().toUpperCase() }),
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Auto-fill item"
    >
      <div className="flex max-h-[92dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold">Auto-fill item</div>
            <div className="text-sm font-medium text-muted">Enter the total and the qty on a full pallet. The rows are filled for you.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-canvas"
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">ITEM</span>
          <input
            autoFocus
            value={name}
            list="paper-items"
            className={field}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setName(v);
              const hit = history.find((h) => h.name === v.trim());
              if (hit) {
                setUnit(hit.unit);
                if (hit.qtyPerPallet) setPer(String(hit.qtyPerPallet));
              }
            }}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">UNIT</span>
          <div className="flex gap-2">
            {QUICK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={cn(
                  "h-11 rounded-lg border-[1.5px] px-4 font-bold",
                  unit === u ? "border-primary bg-primary-soft text-primary" : "border-field",
                )}
              >
                {u}
              </button>
            ))}
            <input
              value={QUICK_UNITS.includes(unit as (typeof QUICK_UNITS)[number]) ? "" : unit}
              placeholder="Other"
              aria-label="Other unit"
              className="h-11 w-28 rounded-lg border-[1.5px] border-field px-3 font-bold uppercase outline-none focus:border-primary"
              onChange={(e) => setUnit(e.target.value.toUpperCase().slice(0, 10) || "CTN")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">TOTAL ({normalizeUnit(unit)})</span>
            <input
              value={total}
              inputMode="numeric"
              placeholder="150"
              className={field}
              onChange={(e) => setTotal(e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">QTY PER PALLET</span>
            <input
              value={per}
              inputMode="numeric"
              placeholder="32"
              className={field}
              onChange={(e) => setPer(e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </label>
        </div>

        {form === "lorry" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">PLT TYPE</span>
              <select value={pltType} onChange={(e) => setPltType(e.target.value as PltType)} className={cn(field, "normal-case")}>
                {PLT_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k} · {PLT_TYPE_NAMES[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">CONTRACT NO</span>
              <input value={contractNo} className={field} onChange={(e) => setContractNo(e.target.value.toUpperCase())} />
            </label>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-[10px] px-3 py-2.5 text-[15px] font-bold",
            qtys.length ? "bg-primary-soft text-primary" : "bg-canvas text-muted",
          )}
          aria-live="polite"
        >
          {qtys.length
            ? `${qtys.length} pallet${qtys.length === 1 ? "" : "s"} · Pallet ${nextStart}${qtys.length > 1 ? `–${end}` : ""}: ${qtys.join(" · ")}`
            : "Pallets appear here as you type."}
        </div>

        <Button className="w-full" disabled={!ready} onClick={add}>
          Add {qtys.length || ""} row{qtys.length === 1 ? "" : "s"} to the sheet
        </Button>
      </div>
    </div>
  );
}
