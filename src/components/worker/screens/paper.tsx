"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLT_TYPES, normalizeUnit, type SheetForm } from "@/lib/tally/constants";
import { isValidPaperDate, normalizeDate } from "@/lib/tally/dates";
import { blankLine, formatQty, totals, type DraftHeader, type DraftItem, type DraftLine, type HeaderErrors } from "@/lib/tally/draft";
import { addRow, dittoRow, removeRow, renameRow, setRowUnit, toRows, updateRowPallet } from "@/lib/tally/paper-rows";
import type { ItemSuggestion } from "../pick";
import { BottomBar, Button } from "../ui";

const HEADER: Record<SheetForm, { key: keyof DraftHeader; label: string; numeric?: boolean }[]> = {
  container: [
    { key: "contractNo", label: "Contract No" },
    { key: "containerNo", label: "Container No" },
    { key: "sealNo", label: "Seal No" },
    { key: "siNo", label: "SI No" },
    { key: "disport", label: "Disport" },
    { key: "date", label: "Date", numeric: true },
  ],
  lorry: [
    { key: "transferTo", label: "Transfer To" },
    { key: "doNo", label: "D/O No" },
    { key: "date", label: "Date", numeric: true },
    { key: "lorryNo", label: "Lorry No" },
  ],
};

const ROWS_PER_PAGE = 25;
const cell = "border border-ink/25 p-0 align-top";
const input =
  "block h-11 w-full min-w-0 bg-transparent px-2 text-[15px] font-semibold uppercase outline-none placeholder:font-medium placeholder:text-placeholder focus:bg-primary-soft";

type LineKey = keyof DraftLine;

/**
 * The tally sheet as it looks on paper: header boxes on top, one row per
 * pallet (row number = sticker number), the item written on each row.
 * Same draft as the step-by-step screens, so the worker can switch any time.
 */
export function PaperScreen({
  form,
  header,
  items,
  errors,
  problems,
  transferSuggestions,
  history,
  onHeader,
  onItems,
  onNext,
}: {
  form: SheetForm;
  header: DraftHeader;
  items: DraftItem[];
  errors: HeaderErrors;
  /** Shown above the sheet after a blocked "Next". */
  problems: string[];
  transferSuggestions: string[];
  history: ItemSuggestion[];
  onHeader: (key: keyof DraftHeader, value: string) => void;
  onItems: (fn: (items: DraftItem[]) => DraftItem[]) => void;
  onNext: () => void;
}) {
  const rows = toRows(items);
  const isLorry = form === "lorry";
  const t = totals(items);
  // Blank rows up to the end of the page, like the printed form.
  const blanks = Math.max(1, Math.ceil((rows.length + 1) / ROWS_PER_PAGE) * ROWS_PER_PAGE - rows.length);

  function setLine(i: number, li: number, k: LineKey, value: string) {
    onItems((its) =>
      updateRowPallet(its, i, (p) => ({ ...p, lines: p.lines.map((l, j) => (j === li ? { ...l, [k]: value } : l)) })),
    );
  }

  function addRowsTo(index: number) {
    onItems((its) => {
      let next = its;
      while (toRows(next).length <= index) next = addRow(next);
      return next;
    });
  }

  function deleteRow(i: number) {
    const p = rows[i].pallet;
    const filled = p.lines.some((l) => l.qty || l.batch || l.expired || l.prod) || !!p.remark;
    if (filled && !window.confirm(`Delete pallet ${i + 1}? The pallets below move up one number.`)) return;
    onItems((its) => removeRow(its, i));
  }

  function lineCells(i: number, k: LineKey, opts: { numeric?: boolean; date?: boolean; placeholder?: string }) {
    const p = rows[i].pallet;
    return (
      <td className={cell}>
        {p.lines.map((l, li) => {
          const bad = opts.date && !!l[k].trim() && !isValidPaperDate(l[k].trim());
          return (
            <input
              key={li}
              value={l[k]}
              aria-label={`Pallet ${i + 1} ${k}${p.lines.length > 1 ? ` line ${li + 1}` : ""}`}
              inputMode={opts.numeric || opts.date ? "numeric" : "text"}
              placeholder={opts.placeholder}
              className={cn(input, li > 0 && "border-t border-dashed border-ink/25", bad && "bg-danger-bg text-danger-ink")}
              onChange={(e) => setLine(i, li, k, opts.numeric ? e.target.value.replace(/\D/g, "").slice(0, 5) : opts.date ? e.target.value : e.target.value.toUpperCase())}
              onBlur={opts.date ? (e) => setLine(i, li, k, normalizeDate(e.target.value)) : undefined}
            />
          );
        })}
      </td>
    );
  }

  return (
    <>
      {problems.length ? (
        <div role="alert" className="flex-none border-b border-danger-border bg-danger-bg px-4 py-2.5 text-sm font-bold text-danger-ink">
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-canvas">
        <div className="mx-auto w-fit min-w-full bg-surface p-3 sm:p-5">
          <div className="mb-1 text-center text-lg font-extrabold tracking-[.04em]">COUNT TALLY SHEET</div>
          <div className="mb-3 text-center text-xs font-bold tracking-[.08em] text-muted">{isLorry ? "LORRY · FORM B" : "CONTAINER · FORM A"}</div>

          <div className={cn("mb-4 grid gap-x-4 gap-y-2", isLorry ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
            {HEADER[form].map((f) => (
              <label key={f.key} className="flex items-end gap-2">
                <span className={cn("pb-1.5 text-xs font-bold whitespace-nowrap uppercase", errors[f.key] ? "text-danger" : "text-body")}>{f.label}:</span>
                <input
                  value={header[f.key]}
                  list={f.key === "transferTo" ? "paper-transfers" : undefined}
                  inputMode={f.numeric ? "numeric" : "text"}
                  placeholder={f.key === "date" ? "141026" : ""}
                  aria-invalid={!!errors[f.key]}
                  title={errors[f.key]}
                  className={cn(
                    "h-9 w-full min-w-0 border-b-2 bg-transparent px-1 text-[15px] font-bold uppercase outline-none focus:border-primary focus:bg-primary-soft",
                    errors[f.key] ? "border-danger bg-danger-bg" : "border-ink/40",
                  )}
                  onChange={(e) => onHeader(f.key, f.key === "date" ? e.target.value : e.target.value.toUpperCase())}
                  onBlur={f.key === "date" ? (e) => onHeader("date", normalizeDate(e.target.value)) : undefined}
                />
              </label>
            ))}
          </div>
          <datalist id="paper-transfers">
            {transferSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <datalist id="paper-items">
            {history.slice(0, 200).map((h) => (
              <option key={h.name} value={h.name} />
            ))}
          </datalist>
          <datalist id="paper-units">
            <option value="CTN" />
            <option value="TIN" />
          </datalist>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-sunken text-[11px] leading-tight font-bold tracking-[.04em] text-body">
                <th className={cn(cell, "sticky left-0 z-10 w-12 bg-surface-sunken px-1 py-2 text-center")}>PLT NO</th>
                {isLorry ? <th className={cn(cell, "w-16 px-2")}>PLT TYPE</th> : null}
                {isLorry ? <th className={cn(cell, "min-w-[120px] px-2")}>CONTRACT NO.</th> : null}
                <th className={cn(cell, "min-w-[210px] px-2")}>ITEM (DESCRIPTION)</th>
                <th className={cn(cell, "min-w-[124px] px-2")}>QTY</th>
                <th className={cn(cell, "min-w-[100px] px-2")}>EXPIRED</th>
                <th className={cn(cell, "min-w-[100px] px-2")}>PROD</th>
                <th className={cn(cell, "min-w-[120px] px-2")}>BATCH</th>
                <th className={cn(cell, "min-w-[110px] px-2")}>REMARK</th>
                <th className={cn(cell, "w-[124px] px-2 text-center")} aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = r.pallet;
                const sameAsAbove = i > 0 && rows[i - 1].name.trim() === r.name.trim() && !!r.name.trim();
                const noName = !r.name.trim();
                return (
                  <tr key={p.id}>
                    <td className={cn(cell, "sticky left-0 z-10 bg-surface text-center align-middle font-condensed text-xl font-extrabold")}>{i + 1}</td>
                    {isLorry ? (
                      <td className={cell}>
                        <select
                          value={p.pltType}
                          aria-label={`Pallet ${i + 1} PLT type`}
                          className="h-11 w-full bg-transparent px-1.5 text-[15px] font-bold outline-none focus:bg-primary-soft"
                          onChange={(e) => onItems((its) => updateRowPallet(its, i, (x) => ({ ...x, pltType: e.target.value as typeof p.pltType })))}
                        >
                          {PLT_TYPES.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    {isLorry ? (
                      <td className={cell}>
                        <input
                          value={p.contractNo}
                          aria-label={`Pallet ${i + 1} contract no`}
                          className={input}
                          onChange={(e) => onItems((its) => updateRowPallet(its, i, (x) => ({ ...x, contractNo: e.target.value.toUpperCase() })))}
                        />
                      </td>
                    ) : null}
                    <td className={cell}>
                      <input
                        value={r.name}
                        list="paper-items"
                        aria-label={`Pallet ${i + 1} item`}
                        placeholder="Item"
                        className={cn(input, sameAsAbove && "text-muted", noName && "bg-danger-bg/60")}
                        onChange={(e) => {
                          const name = e.target.value.toUpperCase();
                          const hit = history.find((h) => h.name === name.trim());
                          onItems((its) => renameRow(its, i, name, hit?.unit));
                        }}
                      />
                    </td>
                    <td className={cell}>
                      <div className="flex">
                        <div className="min-w-0 flex-1">
                          {p.lines.map((l, li) => (
                            <input
                              key={li}
                              value={l.qty}
                              inputMode="numeric"
                              aria-label={`Pallet ${i + 1} qty${p.lines.length > 1 ? ` line ${li + 1}` : ""}`}
                              className={cn(input, "text-right", li > 0 && "border-t border-dashed border-ink/25")}
                              onChange={(e) => setLine(i, li, "qty", e.target.value.replace(/\D/g, "").slice(0, 5))}
                            />
                          ))}
                        </div>
                        <input
                          value={r.unit}
                          list="paper-units"
                          aria-label={`Pallet ${i + 1} unit`}
                          className="h-11 w-[52px] flex-none border-l border-ink/15 bg-transparent px-1 text-center text-xs font-bold text-muted uppercase outline-none focus:bg-primary-soft"
                          onChange={(e) => onItems((its) => setRowUnit(its, i, e.target.value.toUpperCase().slice(0, 10)))}
                          onBlur={(e) => onItems((its) => setRowUnit(its, i, normalizeUnit(e.target.value)))}
                        />
                      </div>
                    </td>
                    {lineCells(i, "expired", { date: true, placeholder: "DD/MM/YY" })}
                    {lineCells(i, "prod", { date: true, placeholder: "DD/MM/YY" })}
                    {lineCells(i, "batch", {})}
                    <td className={cell}>
                      <input
                        value={p.remark}
                        aria-label={`Pallet ${i + 1} remark`}
                        className={input}
                        onChange={(e) => onItems((its) => updateRowPallet(its, i, (x) => ({ ...x, remark: e.target.value.toUpperCase() })))}
                      />
                    </td>
                    <td className={cn(cell, "align-middle")}>
                      <div className="flex items-center justify-center gap-0.5 px-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          title="Same as above (〃)"
                          aria-label={`Pallet ${i + 1}: same as above`}
                          onClick={() => onItems((its) => dittoRow(its, i))}
                          className="grid size-9 place-items-center rounded-md text-xl font-extrabold text-primary hover:bg-primary-soft disabled:opacity-25"
                        >
                          〃
                        </button>
                        <button
                          type="button"
                          title={p.lines.length > 1 ? "Remove the last batch" : "Add a batch (mixed pallet)"}
                          aria-label={p.lines.length > 1 ? `Pallet ${i + 1}: remove the last batch` : `Pallet ${i + 1}: add a batch`}
                          onClick={() =>
                            onItems((its) =>
                              updateRowPallet(its, i, (x) => ({ ...x, lines: x.lines.length > 1 ? x.lines.slice(0, -1) : [...x.lines, blankLine()] })),
                            )
                          }
                          className="grid h-9 min-w-9 place-items-center rounded-md px-1 text-xs font-extrabold text-primary hover:bg-primary-soft"
                        >
                          {p.lines.length > 1 ? "−B" : "+B"}
                        </button>
                        <button
                          type="button"
                          title="Delete row"
                          aria-label={`Delete pallet ${i + 1}`}
                          onClick={() => deleteRow(i)}
                          className="grid size-9 place-items-center rounded-md text-muted hover:bg-danger-bg hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: blanks }, (_, b) => {
                const index = rows.length + b;
                return (
                  <tr key={`blank-${index}`} onClick={() => addRowsTo(index)} className="cursor-pointer text-faint hover:bg-primary-soft/60">
                    <td className={cn(cell, "sticky left-0 z-10 h-11 bg-surface text-center align-middle font-condensed text-xl font-extrabold")}>{index + 1}</td>
                    <td className={cn(cell, "px-2 align-middle text-sm font-semibold")} colSpan={isLorry ? 9 : 7}>
                      {b === 0 ? (
                        <span className="flex items-center gap-1.5 text-primary">
                          <Plus className="size-4" /> Tap to fill pallet {index + 1}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-[15px] font-bold">
            Total: {t.pallets} pallet{t.pallets === 1 ? "" : "s"} · {formatQty(t.qty)}
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            〃 copies batch and dates from the row above. +B adds a second batch for a mixed pallet. Dates: type 160427 for 16/04/27.
          </p>
        </div>
      </div>

      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          Next · {isLorry ? "Materials & pallets" : "Packing materials"}
        </Button>
      </BottomBar>
    </>
  );
}
