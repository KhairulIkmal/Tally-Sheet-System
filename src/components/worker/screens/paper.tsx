"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLT_TYPES, normalizeUnit, type SheetForm, MAX_PALLETS } from "@/lib/tally/constants";
import { isValidPaperDate, normalizeDate } from "@/lib/tally/dates";
import {
  blankLine,
  countStatus,
  type CountStatus,
  formatQty,
  itemQty,
  palletQty,
  palletRanges,
  totals,
  type Draft,
  type DraftHeader,
  type DraftItem,
  type DraftLine,
  type HeaderErrors,
  type LineField,
} from "@/lib/tally/draft";
import {
  addRow,
  appendItem,
  dittoField,
  dittoItem,
  fillDown,
  removeRows,
  type FillSpec,
  dittoSource,
  removeRow,
  renameRow,
  setRowUnit,
  toRows,
  updateRowPallet,
} from "@/lib/tally/paper-rows";
import type { ItemSuggestion } from "../pick";
import { BottomBar, Button } from "../ui";
import { itemRowMarks, itemTotalText } from "@/lib/tally/sheet";
import { PaperFooter } from "./paper-footer";
import { AutoFillPanel } from "./paper-autofill";
import { ZoomControls, usePaperZoom } from "./paper-zoom";
import { DittoHandle, deleteRowMark, fillCell, useDeleteDrag, useFillDrag } from "./paper-fill";

/** Header boxes in the printed order: two columns, left then right. */
const HEADER: Record<SheetForm, { key: keyof DraftHeader; label: string; numeric?: boolean }[]> = {
  container: [
    // Two columns, as on the paper: Contract, Container, Seal on the left; SI, Disport, Date on the right.
    { key: "contractNo", label: "Contract No" },
    { key: "siNo", label: "SI No" },
    { key: "containerNo", label: "Container No" },
    { key: "disport", label: "Disport" },
    { key: "sealNo", label: "Seal No" },
    { key: "date", label: "Date", numeric: true },
  ],
  lorry: [
    { key: "transferTo", label: "Transfer To" },
    { key: "date", label: "Date", numeric: true },
    { key: "doNo", label: "D/O No" },
    { key: "lorryNo", label: "Lorry No" },
  ],
};

/** Fix from the review: which sheet row (0-based) and which cells to mark. */
export interface PaperFix {
  row: number;
  /** The cells to fill; none marks the whole row. */
  fields?: LineField[];
  label: string;
  /** Changes on every Fix tap, so the same row scrolls again. */
  seq: number;
}

/** A cell to fix: amber, outlined, until it is filled. */
const fixCell = "bg-warning-bg outline-2 -outline-offset-2 outline-warning";

const cell = "border border-ink/25 p-0 align-top";
const input =
  "block h-11 w-full min-w-0 bg-transparent px-2 text-[15px] font-semibold uppercase outline-none placeholder:font-medium placeholder:text-placeholder focus:bg-primary-soft";

type LineKey = keyof DraftLine;
const DITTO: LineKey[] = ["qty", "batch", "expired", "prod"];

/**
 * The tally sheet as it looks on paper: header boxes on top, one row per
 * pallet (row number = sticker number), the item written on each row.
 * Same draft as the step-by-step screens, so the worker can switch any time.
 */
export function PaperScreen({
  draft,
  signerName,
  onEdit,
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
  fix = null,
  onFixDone,
  onBackToReview,
}: {
  /** For the footer (materials, remark, PLT totals, signature). */
  draft: Draft;
  signerName: string;
  onEdit: (fn: (d: Draft) => void) => void;
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
  /** Opened from Fix on the review: the row and cells to mark. */
  fix?: PaperFix | null;
  onFixDone?: () => void;
  onBackToReview?: () => void;
}) {
  const [autoFill, setAutoFill] = useState(false);
  // A cell from Fix stays marked while it is still empty or wrong.
  const needsFix = (i: number, k: LineField) => {
    if (!fix || fix.row !== i || !fix.fields?.includes(k)) return false;
    return rows[i]?.pallet.lines.some((l) => {
      const v = l[k].trim();
      return k === "qty" ? !v || v === "0" : k === "batch" ? !v : !v || !isValidPaperDate(v);
    });
  };
  const { zoom, setZoom, fit, scrollRef, sheetRef } = usePaperZoom();
  // Scroll the row from Fix into the middle and put the cursor in its first marked cell.
  useEffect(() => {
    if (!fix) return;
    const t = window.setTimeout(() => {
      const tr = sheetRef.current?.querySelector<HTMLElement>(`tr[data-row="${fix.row}"]`);
      tr?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      tr?.querySelector<HTMLInputElement>("[data-fix] input")?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(t);
  }, [fix, sheetRef]);
  // 〃 held and dragged down fills every row the finger passes; rows past the
  // end of the sheet are added first.
  const fill = useFillDrag(scrollRef, (from, to, spec) =>
    onItems((its) => {
      let next = its;
      const last = Math.min(to, MAX_PALLETS - 1);
      while (toRows(next).length <= last) next = addRow(next);
      return fillDown(next, from, last, spec);
    }),
  );
  // A pallet row that continues the item above shows the paper's blank (or TOTAL) until tapped.
  const [nameRow, setNameRow] = useState<number | null>(null);
  const rows = toRows(items);
  // Auto-fill starts after the last row with anything on it.
  let filled = rows.length;
  while (
    filled > 0 &&
    !rows[filled - 1].name.trim() &&
    rows[filled - 1].pallet.lines.every((l) => !l.qty && !l.batch && !l.expired && !l.prod)
  )
    filled--;
  const lastFilled = filled > 0 ? rows[filled - 1].pallet : null;
  const ranges = palletRanges(items);
  // As written on paper: the name on an item's first row, its TOTAL on the second
  // (under the name when it has one pallet), the last pallet circled.
  const marks = items.flatMap((it) => {
    const qtys = it.pallets.map(palletQty);
    const unit = normalizeUnit(it.unit);
    const total = itemTotalText(unit, it.targetQty, qtys);
    // While filling in only: how far the counted pallets are from the TOTAL. The printed sheet doesn't show it.
    const check = countStatus(
      qtys.reduce((a, b) => a + b, 0),
      it.targetQty,
      unit,
    );
    return itemRowMarks(it.name.trim(), unit, it.targetQty, qtys).map((m, j) => {
      const totalRow = j === (qtys.length > 1 ? 1 : 0);
      return { first: j === 0, total: totalRow ? total : "", check: totalRow ? check : null, circled: !!m.circled };
    });
  });
  const isLorry = form === "lorry";
  const t = totals(items);
  // Blank rows up to the end of the page, like the printed form.
  // Blank rows up to the 25th: a sheet is one paper form and never has more.
  const blanks = Math.max(0, MAX_PALLETS - rows.length);
  const full = rows.length >= MAX_PALLETS;

  function setLine(i: number, li: number, k: LineKey, value: string) {
    onItems((its) =>
      updateRowPallet(its, i, (p) => ({
        ...p,
        lines: p.lines.map((l, j) => (j === li ? { ...l, [k]: value } : l)),
      })),
    );
  }

  function addRowsTo(index: number) {
    onItems((its) => {
      let next = its;
      while (toRows(next).length <= Math.min(index, MAX_PALLETS - 1)) next = addRow(next);
      return next;
    });
  }

  // Deleting can't be undone, so anything with writing on it is confirmed twice.
  const hasWriting = (i: number) => {
    const r = rows[i];
    return !!r.name.trim() || !!r.pallet.remark || r.pallet.lines.some((l) => l.qty || l.batch || l.expired || l.prod);
  };
  const reallyDelete = (what: string) => window.confirm(`Are you sure? ${what} will be removed for good. This cannot be undone.`);

  const del = useDeleteDrag(scrollRef, (from, to) => {
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    const n = b - a + 1;
    const filled = Array.from({ length: n }, (_, k) => a + k).filter(hasWriting).length;
    const what = `Pallets ${a + 1}–${b + 1}`;
    if (
      !window.confirm(
        `Delete ${n} pallets (${a + 1}–${b + 1})?${filled ? ` ${filled} of them have writing on them.` : ""} The pallets below move up ${n} numbers.`,
      )
    )
      return;
    if (filled && !reallyDelete(what)) return;
    onItems((its) => removeRows(its, a, b));
  });

  function deleteRow(i: number) {
    if (hasWriting(i)) {
      if (!window.confirm(`Delete pallet ${i + 1}? The pallets below move up one number.`)) return;
      if (!reallyDelete(`Pallet ${i + 1}`)) return;
    }
    onItems((its) => removeRow(its, i));
  }

  function lineCells(i: number, k: LineKey, opts: { numeric?: boolean; date?: boolean; placeholder?: string }) {
    const p = rows[i].pallet;
    return (
      <td className={cell}>
        {p.lines.map((l, li) => {
          const bad = opts.date && !!l[k].trim() && !isValidPaperDate(l[k].trim());
          const field = DITTO.includes(k) ? k : null;
          const source = field ? dittoSource(items, i, li, field) : "";
          const canDitto = !!source && source !== l[k];
          const spec: FillSpec | null = field ? { kind: "line", field, li } : null;
          return (
            <div
              key={li}
              data-fix={needsFix(i, k as LineField) || undefined}
              className={cn(
                "flex items-center",
                li > 0 && "border-t border-dashed border-ink/25",
                needsFix(i, k as LineField) && fixCell,
                spec && fill.covers(spec, i) && fillCell,
              )}
            >
              <input
                value={l[k]}
                aria-label={`Pallet ${i + 1} ${k}${p.lines.length > 1 ? ` line ${li + 1}` : ""}`}
                inputMode={opts.numeric || opts.date ? "numeric" : "text"}
                placeholder={opts.placeholder}
                className={cn(input, bad && "bg-danger-bg text-danger-ink")}
                onChange={(e) =>
                  setLine(
                    i,
                    li,
                    k,
                    opts.numeric
                      ? e.target.value.replace(/\D/g, "").slice(0, 5)
                      : opts.date
                        ? e.target.value
                        : e.target.value.toUpperCase(),
                  )
                }
                onBlur={opts.date ? (e) => setLine(i, li, k, normalizeDate(e.target.value)) : undefined}
              />
              {canDitto && spec ? (
                <DittoHandle
                  what={k}
                  value={source}
                  pallet={i + 1}
                  onCopy={() => onItems((its) => dittoField(its, i, li, field!))}
                  onStart={(e) => fill.start(e, spec, i, source, () => onItems((its) => dittoField(its, i, li, field!)))}
                />
              ) : null}
            </div>
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* pan-x pan-y: two fingers zoom the sheet (usePaperZoom), not the whole page. */}
        <div ref={scrollRef} className="min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto bg-canvas pb-16">
          <div ref={sheetRef} style={{ zoom, minWidth: zoom === 1 ? "100%" : undefined }} className="mx-auto w-fit bg-surface p-3 sm:p-5">
            <div className="mb-1 text-center text-lg font-extrabold tracking-[.04em]">COUNT TALLY SHEET</div>

            <div className="mt-3 mb-4 grid grid-cols-2 gap-x-6 gap-y-2">
              {HEADER[form].map((f) => (
                <label key={f.key} className="flex items-end gap-2">
                  <span className={cn("pb-1.5 text-xs font-bold whitespace-nowrap uppercase", errors[f.key] ? "text-danger" : "text-body")}>
                    {f.label}:
                  </span>
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

            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAutoFill(true)}
                disabled={filled >= MAX_PALLETS}
                title={filled >= MAX_PALLETS ? `This sheet is full: ${MAX_PALLETS} pallets` : undefined}
                className="flex h-10 items-center gap-2 rounded-lg border-[1.5px] border-primary px-3.5 text-sm font-bold text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Calculator className="size-4" /> Auto-fill item
              </button>
            </div>
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
                  <th className={cn(cell, "w-[88px] px-2 text-center")} aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = r.pallet;
                  const above = i > 0 ? rows[i - 1] : null;
                  const noName = !r.name.trim();
                  return (
                    <tr
                      key={p.id}
                      data-row={i}
                      className={cn(
                        del.covers(i) && deleteRowMark,
                        fix?.row === i && !fix.fields?.length && "outline-2 -outline-offset-2 outline-warning",
                      )}
                    >
                      <td
                        className={cn(cell, "sticky left-0 z-10 bg-surface text-center align-middle font-condensed text-xl font-extrabold")}
                      >
                        {i + 1}
                      </td>
                      {isLorry ? (
                        <td className={cell}>
                          <select
                            value={p.pltType}
                            aria-label={`Pallet ${i + 1} PLT type`}
                            className="h-11 w-full bg-transparent px-1.5 text-[15px] font-bold outline-none focus:bg-primary-soft"
                            onChange={(e) =>
                              onItems((its) =>
                                updateRowPallet(its, i, (x) => ({
                                  ...x,
                                  pltType: e.target.value as typeof p.pltType,
                                })),
                              )
                            }
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
                          <div className={cn("flex items-center", fill.covers({ kind: "contract" }, i) && fillCell)}>
                            <input
                              value={p.contractNo}
                              aria-label={`Pallet ${i + 1} contract no`}
                              className={input}
                              onChange={(e) =>
                                onItems((its) =>
                                  updateRowPallet(its, i, (x) => ({
                                    ...x,
                                    contractNo: e.target.value.toUpperCase(),
                                  })),
                                )
                              }
                            />
                            {above?.pallet.contractNo && above.pallet.contractNo !== p.contractNo ? (
                              <DittoHandle
                                what="contract no"
                                value={above.pallet.contractNo}
                                pallet={i + 1}
                                onCopy={() =>
                                  onItems((its) => updateRowPallet(its, i, (x) => ({ ...x, contractNo: above.pallet.contractNo })))
                                }
                                onStart={(e) =>
                                  fill.start(e, { kind: "contract" }, i, above.pallet.contractNo, () =>
                                    onItems((its) => updateRowPallet(its, i, (x) => ({ ...x, contractNo: above.pallet.contractNo }))),
                                  )
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      <td className={cell}>
                        {!marks[i]?.first && r.name.trim() && nameRow !== i ? (
                          <button
                            type="button"
                            aria-label={`Pallet ${i + 1} item: ${r.name.trim()}. Tap to change`}
                            title={r.name.trim()}
                            className="flex h-10 w-full items-center px-2 text-left hover:bg-primary-soft"
                            onClick={() => setNameRow(i)}
                          >
                            {marks[i]?.total ? (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="text-[13px] font-extrabold tracking-[.03em] whitespace-nowrap text-danger">
                                  {marks[i].total}
                                </span>
                                <TotalCheck check={marks[i].check} />
                              </span>
                            ) : (
                              <span className="text-lg font-bold text-faint">〃</span>
                            )}
                          </button>
                        ) : (
                          <>
                            <div className={cn("flex items-center", fill.covers({ kind: "item" }, i) && fillCell)}>
                              <input
                                autoFocus={nameRow === i}
                                onBlur={() => nameRow === i && setNameRow(null)}
                                value={r.name}
                                list="paper-items"
                                aria-label={`Pallet ${i + 1} item`}
                                placeholder="Item"
                                className={cn(input, noName && "bg-danger-bg/60")}
                                onChange={(e) => {
                                  const name = e.target.value.toUpperCase();
                                  const hit = history.find((h) => h.name === name.trim());
                                  onItems((its) => renameRow(its, i, name, hit?.unit));
                                }}
                              />
                              {above?.name.trim() && above.name.trim() !== r.name.trim() ? (
                                <DittoHandle
                                  what="item"
                                  value={above.name.trim()}
                                  pallet={i + 1}
                                  onCopy={() => onItems((its) => dittoItem(its, i))}
                                  onStart={(e) =>
                                    fill.start(e, { kind: "item" }, i, above.name.trim(), () => onItems((its) => dittoItem(its, i)))
                                  }
                                />
                              ) : null}
                            </div>
                            {marks[i]?.first && marks[i].total && r.name.trim() ? (
                              <div className="-mt-1 flex items-center gap-1.5 px-2 pb-1">
                                <span className="text-[11px] font-bold tracking-[.03em] text-danger">{marks[i].total}</span>
                                <TotalCheck check={marks[i].check} />
                              </div>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className={cell}>
                        <div className="flex">
                          <div className="min-w-0 flex-1">
                            {p.lines.map((l, li) => {
                              const circleAt = marks[i]?.circled ? p.lines.findLastIndex((x) => !!x.qty) : -1;
                              const source = dittoSource(items, i, li, "qty");
                              return (
                                <div
                                  key={li}
                                  title={li === circleAt ? "Last pallet of this item" : undefined}
                                  className={cn(
                                    "relative flex items-center",
                                    li > 0 && "border-t border-dashed border-ink/25",
                                    li === circleAt && "text-danger",
                                    needsFix(i, "qty") && fixCell,
                                    fill.covers({ kind: "line", field: "qty", li }, i) && fillCell,
                                  )}
                                  data-fix={needsFix(i, "qty") || undefined}
                                >
                                  {/* The item's last pallet is circled, as on paper: only the last batch's qty, drawn over the
                                    cell so the line keeps the same height as Expired, Prod and Batch beside it. */}
                                  {li === circleAt ? (
                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute inset-x-1 inset-y-1 rounded-full ring-2 ring-danger"
                                    />
                                  ) : null}
                                  {source && source !== l.qty ? (
                                    <DittoHandle
                                      what="qty"
                                      value={source}
                                      pallet={i + 1}
                                      className="ml-0.5"
                                      onCopy={() => onItems((its) => dittoField(its, i, li, "qty"))}
                                      onStart={(e) =>
                                        fill.start(e, { kind: "line", field: "qty", li }, i, source, () =>
                                          onItems((its) => dittoField(its, i, li, "qty")),
                                        )
                                      }
                                    />
                                  ) : null}
                                  <input
                                    value={l.qty}
                                    inputMode="numeric"
                                    aria-label={`Pallet ${i + 1} qty${p.lines.length > 1 ? ` line ${li + 1}` : ""}`}
                                    className={cn(input, "text-right")}
                                    onChange={(e) => setLine(i, li, "qty", e.target.value.replace(/\D/g, "").slice(0, 5))}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <input
                            value={r.unit}
                            list="paper-units"
                            aria-label={`Pallet ${i + 1} unit`}
                            className="h-11 w-[52px] flex-none self-center border-l border-ink/15 bg-transparent px-1 text-center text-xs font-bold text-muted uppercase outline-none focus:bg-primary-soft"
                            onChange={(e) => onItems((its) => setRowUnit(its, i, e.target.value.toUpperCase().slice(0, 10)))}
                            onBlur={(e) => onItems((its) => setRowUnit(its, i, normalizeUnit(e.target.value)))}
                          />
                        </div>
                      </td>
                      {lineCells(i, "expired", {
                        date: true,
                        placeholder: "DD/MM/YY",
                      })}
                      {lineCells(i, "prod", {
                        date: true,
                        placeholder: "DD/MM/YY",
                      })}
                      {lineCells(i, "batch", {})}
                      <td className={cell}>
                        <input
                          value={p.remark}
                          aria-label={`Pallet ${i + 1} remark`}
                          className={input}
                          onChange={(e) =>
                            onItems((its) =>
                              updateRowPallet(its, i, (x) => ({
                                ...x,
                                remark: e.target.value.toUpperCase(),
                              })),
                            )
                          }
                        />
                      </td>
                      <td className={cn(cell, "align-middle")}>
                        <div className="flex items-center justify-center gap-0.5 px-1">
                          <button
                            type="button"
                            title={p.lines.length > 1 ? "Remove the last batch" : "Add a batch (mixed pallet)"}
                            aria-label={p.lines.length > 1 ? `Pallet ${i + 1}: remove the last batch` : `Pallet ${i + 1}: add a batch`}
                            onClick={() =>
                              onItems((its) =>
                                updateRowPallet(its, i, (x) => ({
                                  ...x,
                                  lines: x.lines.length > 1 ? x.lines.slice(0, -1) : [...x.lines, blankLine()],
                                })),
                              )
                            }
                            className="grid h-9 min-w-9 place-items-center rounded-md px-1 text-xs font-extrabold text-primary hover:bg-primary-soft"
                          >
                            {p.lines.length > 1 ? "−B" : "+B"}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete pallet ${i + 1}`}
                            title="Delete row. Hold and drag up or down to delete several rows."
                            onPointerDown={(e) => del.start(e, i, () => deleteRow(i))}
                            // Taps are handled on pointer up; keyboard presses come here.
                            onClick={(e) => e.detail === 0 && deleteRow(i)}
                            className="grid size-9 cursor-grab touch-none place-items-center rounded-md text-muted select-none hover:bg-danger-bg hover:text-danger active:cursor-grabbing"
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
                    <tr
                      key={`blank-${index}`}
                      data-row={index}
                      onClick={() => addRowsTo(index)}
                      className="cursor-pointer text-faint hover:bg-primary-soft/60"
                    >
                      <td
                        className={cn(
                          cell,
                          "sticky left-0 z-10 h-11 bg-surface text-center align-middle font-condensed text-xl font-extrabold",
                        )}
                      >
                        {index + 1}
                      </td>
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
                {full ? (
                  <tr>
                    <td colSpan={isLorry ? 10 : 8} className={cn(cell, "bg-surface-sunken px-3 py-2.5 text-sm font-semibold text-muted")}>
                      This sheet is full: {MAX_PALLETS} pallets, the same as the paper form. Start a new sheet for more.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="mt-2 text-right text-sm font-bold text-muted">
              Total: {t.pallets} pallet{t.pallets === 1 ? "" : "s"} · {formatQty(t.qty)}
            </div>
            {items.some((it) => it.name.trim()) ? (
              <div className="mt-3 flex flex-col gap-1 rounded-[10px] border border-line bg-surface-sunken px-3 py-2">
                {items.map((it, k) => {
                  if (!it.name.trim()) return null;
                  const st = countStatus(itemQty(it), it.targetQty, it.unit);
                  const r = ranges[k];
                  return (
                    <div key={it.id} className="flex flex-wrap items-center justify-between gap-x-3 text-sm font-semibold">
                      <span>
                        {it.name}{" "}
                        <span className="text-muted">
                          · Pallet {r.start}
                          {r.end > r.start ? `–${r.end}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "font-extrabold",
                          (st.state === "ok" || (st.state === "none" && st.counted > 0)) && "text-success",
                          st.state === "short" && "text-warning",
                          st.state === "over" && "text-danger",
                        )}
                      >
                        {st.state === "none" && st.counted > 0 ? `${st.counted} / ${st.label} ✓` : st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <PaperFooter draft={draft} signerName={signerName} onEdit={onEdit} />
            <p className="mt-1 text-xs font-medium text-muted">
              Each row is filled on its own. Tap 〃 in a cell (Item, Contract, Qty, Batch, Expired, Prod) to copy just that value from the
              row above. +B adds a second batch for a mixed pallet. Dates: type 160427 for 16/04/27.
            </p>
          </div>
        </div>
        <ZoomControls zoom={zoom} setZoom={setZoom} fit={fit} />
        {fix ? (
          <div className="absolute inset-x-3 top-3 z-20 mx-auto flex max-w-[560px] items-center gap-2 rounded-xl border border-warning-border bg-warning-bg py-1.5 pr-1.5 pl-3.5 text-sm font-bold text-warning-ink shadow-[0_8px_24px_rgba(0,0,0,.15)]">
            <span className="min-w-0 flex-1 truncate">
              {fix.fields?.length && !fix.fields.some((k) => needsFix(fix.row, k)) ? `${fix.label.split(":")[0]}: fixed ✓` : fix.label}
            </span>
            {onBackToReview ? (
              <button type="button" onClick={onBackToReview} className="h-9 flex-none rounded-lg bg-primary px-3 text-white">
                Back to review
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              onClick={onFixDone}
              className="grid size-9 flex-none place-items-center rounded-lg hover:bg-warning-border/50"
            >
              ×
            </button>
          </div>
        ) : null}
        {del.range ? (
          <div
            role="status"
            className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_24px_rgba(0,0,0,.25)]"
          >
            Delete pallet {del.range.from + 1}
            {del.range.to > del.range.from ? `–${del.range.to + 1}` : ""} · let go to delete
          </div>
        ) : null}
        {fill.drag ? (
          <div
            role="status"
            className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_24px_rgba(0,0,0,.25)]"
          >
            〃 {fill.drag.value} → pallet {fill.drag.from + 1}
            {fill.drag.to > fill.drag.from ? `–${fill.drag.to + 1}` : ""} · let go to copy
          </div>
        ) : null}
      </div>

      {autoFill ? (
        <AutoFillPanel
          form={form}
          history={history}
          nextStart={filled + 1}
          room={MAX_PALLETS - filled}
          defaults={{ pltType: lastFilled?.pltType ?? "L", contractNo: lastFilled?.contractNo ?? "" }}
          onClose={() => setAutoFill(false)}
          onAdd={(item) => {
            onItems((its) => appendItem(its, item));
            setAutoFill(false);
          }}
        />
      ) : null}
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          Next · Review
        </Button>
      </BottomBar>
    </>
  );
}

/** Beside the red TOTAL while filling in: what is still needed, or a tick once the count matches. */
function TotalCheck({ check }: { check: CountStatus | null | undefined }) {
  // With no TOTAL typed, the TOTAL written is the sum of the pallets, so it always matches.
  if (!check || (check.state === "none" && check.counted <= 0)) return null;
  const [text, tone, title] =
    check.state === "ok" || check.state === "none"
      ? ["✓", "bg-success-bg text-success border-success-border", check.state === "ok" ? "Total met" : "Total of the pallets typed"]
      : check.state === "short"
        ? [`${check.diff} left`, "bg-warning-bg text-warning-ink border-warning-border", `${check.diff} more to reach the total`]
        : [`${check.diff} over`, "bg-danger-bg text-danger-ink border-danger-border", `${check.diff} more than the total`];
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex h-5 flex-none items-center rounded-full border px-1.5 text-[11px] font-extrabold whitespace-nowrap", tone)}
    >
      {text}
    </span>
  );
}
