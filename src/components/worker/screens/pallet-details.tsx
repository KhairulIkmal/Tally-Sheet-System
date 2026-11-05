"use client";

import { useEffect, useState } from "react";
import { ArrowUp, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_LINES_PER_PALLET, MAX_PALLETS, type SheetForm } from "@/lib/tally/constants";
import { calendarInputToPaperDate, isValidPaperDate, normalizeDate } from "@/lib/tally/dates";
import {
  blankLine,
  newId,
  countStatus,
  itemQty,
  palletQty,
  previousPallet,
  samePltType,
  type DraftItem,
  type DraftLine,
  type DraftPallet,
} from "@/lib/tally/draft";
import { PltTypeButtons } from "./pallet-setup";
import { BottomBar, Button, PalletBadge, Scroll } from "../ui";

type Mutator = (item: DraftItem, all: DraftItem[]) => void;

const STATUS_BG = { none: "bg-solid text-on-solid", ok: "bg-success text-white", short: "bg-warning text-white", over: "bg-danger text-white" } as const;

function SameButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-1 right-1 flex h-12 w-11 flex-col items-center justify-center rounded-[7px] bg-canvas text-[10px] font-bold text-primary"
    >
      <ArrowUp className="size-4" strokeWidth={2.5} />
      same
    </button>
  );
}

function fieldBorder(value: string, valid = true) {
  if (!value) return "border-[1.5px] border-[#e7c98a] dark:border-[#6b4f17]";
  if (!valid) return "border-2 border-danger";
  return "border-[1.5px] border-field";
}

function DateField({
  label,
  value,
  placeholder,
  hasPrev,
  onChange,
  onCopy,
}: {
  label: string;
  value: string;
  placeholder: string;
  hasPrev: boolean;
  onChange: (v: string) => void;
  onCopy: () => void;
}) {
  const normalized = normalizeDate(value);
  const hint = value && normalized !== value && isValidPaperDate(normalized) ? `→ ${normalized}` : "";
  const invalid = !!value && !hint && !isValidPaperDate(value);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex h-[18px] items-center justify-between">
        <span className="text-xs font-bold text-muted">{label}</span>
        <label className="relative flex cursor-pointer items-center gap-1 py-1 text-xs font-bold text-primary">
          <CalendarDays className="size-3.5" />
          Calendar
          <input
            type="date"
            aria-label={`${label} calendar`}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            onChange={(e) => e.target.value && onChange(calendarInputToPaperDate(e.target.value))}
          />
        </label>
      </div>
      <div className="relative">
        <input
          value={value}
          inputMode="numeric"
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizeDate(e.target.value))}
          className={cn(
            "h-14 w-full rounded-[9px] bg-surface pr-[50px] pl-2.5 text-lg font-bold text-ink outline-none focus:border-2 focus:border-primary",
            fieldBorder(value, !invalid),
          )}
        />
        {hasPrev ? <SameButton onClick={onCopy} label={`${label} same as above`} /> : null}
      </div>
      <span className={cn("min-h-4 text-[13px] font-bold", invalid ? "text-danger" : "text-success")}>{invalid ? "Not a date" : hint}</span>
    </div>
  );
}

function LineFields({
  line,
  index,
  unit,
  mixed,
  hasPrev,
  onSet,
  onCopy,
  onRemove,
}: {
  line: DraftLine;
  index: number;
  unit: string;
  mixed: boolean;
  hasPrev: boolean;
  onSet: (field: keyof DraftLine, value: string) => void;
  onCopy: (field: keyof DraftLine) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn("flex flex-col gap-2", index > 0 && "border-t-[1.5px] border-dashed border-field pt-2.5")}>
      {mixed ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-[.04em] text-muted">LINE {"ABCDEF"[index]}</span>
          <button type="button" onClick={onRemove} className="flex h-9 items-center px-2.5 text-[13px] font-bold text-danger">
            Remove line
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex h-[18px] items-center text-xs font-bold text-muted">QTY ({unit})</span>
          <div className="relative">
            <input
              value={line.qty}
              inputMode="numeric"
              placeholder="0"
              aria-label={`Qty (${unit})`}
              onChange={(e) => onSet("qty", e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={cn(
                "h-14 w-full rounded-[9px] border-[1.5px] border-field bg-surface pl-3 text-2xl font-bold text-ink outline-none focus:border-2 focus:border-primary",
                hasPrev ? "pr-[50px]" : "pr-3",
              )}
            />
            {hasPrev ? <SameButton onClick={() => onCopy("qty")} label="Qty same as above" /> : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex h-[18px] items-center text-xs font-bold text-muted">BATCH</span>
          <div className="relative">
            <input
              value={line.batch}
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Batch"
              autoComplete="off"
              onChange={(e) => onSet("batch", e.target.value.toUpperCase())}
              className={cn(
                "h-14 w-full rounded-[9px] bg-surface pr-[50px] pl-3 text-lg font-bold text-ink uppercase outline-none focus:border-2 focus:border-primary",
                fieldBorder(line.batch),
              )}
            />
            {hasPrev ? <SameButton onClick={() => onCopy("batch")} label="Batch same as above" /> : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DateField label="EXPIRED" value={line.expired} placeholder="160427" hasPrev={hasPrev} onChange={(v) => onSet("expired", v)} onCopy={() => onCopy("expired")} />
        <DateField label="PROD" value={line.prod} placeholder="160425" hasPrev={hasPrev} onChange={(v) => onSet("prod", v)} onCopy={() => onCopy("prod")} />
      </div>
    </div>
  );
}

export function PalletDetailsScreen({
  form,
  items,
  itemIndex,
  startNo,
  focusPallet = null,
  saveLabel = "Save item",
  onUpdate,
  onSave,
}: {
  form: SheetForm;
  items: DraftItem[];
  itemIndex: number;
  startNo: number;
  /** Pallet (index within the item) to scroll to and highlight on open. */
  focusPallet?: number | null;
  saveLabel?: string;
  onUpdate: (mutate: Mutator) => void;
  onSave: () => void;
}) {
  const item = items[itemIndex];
  const [flash, setFlash] = useState<number | null>(focusPallet);
  useEffect(() => {
    if (focusPallet === null) return;
    document.getElementById(`pallet-card-${focusPallet}`)?.scrollIntoView({ block: "center" });
    const t = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(t);
  }, [focusPallet]);
  const status = countStatus(itemQty(item), item.targetQty, item.unit);

  const setPallet = (i: number, fn: (p: DraftPallet, all: DraftItem[]) => void) =>
    onUpdate((it, all) => {
      fn(it.pallets[i], all);
    });

  return (
    <>
      <div className={cn("flex h-[52px] flex-none items-center justify-between px-4", STATUS_BG[status.state])} aria-live="polite">
        <span className="text-[15px] font-semibold">Item total</span>
        <span className="text-2xl font-extrabold">{status.label}</span>
      </div>
      <Scroll className="gap-3 p-3">
        {item.pallets.map((p, i) => {
          const no = startNo + i;
          const prev = previousPallet(items, itemIndex, i);
          const mixed = p.lines.length > 1;
          return (
            <div
              key={p.id}
              id={`pallet-card-${i}`}
              className={cn(
                "flex flex-none flex-col gap-2.5 rounded-[14px] bg-surface p-3 transition-shadow",
                mixed ? "border-2 border-primary" : "border border-line",
                flash === i && "ring-4 ring-warning",
              )}
            >
              <div className="flex items-center gap-3">
                <PalletBadge no={no} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="text-[17px] font-bold">
                    Pallet {no}
                    {mixed ? ` · ${p.lines.length} batches` : ""}
                  </div>
                  {mixed ? (
                    <span className="self-start rounded-[5px] bg-solid px-2 py-0.5 text-[11px] font-bold tracking-[.06em] text-on-solid">MIXED PALLET</span>
                  ) : null}
                </div>
                <span className="text-2xl font-extrabold">{palletQty(p) || ""}</span>
                <button
                  type="button"
                  aria-label={`Remove pallet ${no}`}
                  title="Remove pallet"
                  onClick={() => {
                    if (palletQty(p) === 0 || window.confirm(`Remove pallet ${no}? Pallets after it are renumbered.`)) {
                      onUpdate((it) => {
                        it.pallets.splice(i, 1);
                      });
                    }
                  }}
                  className="grid h-12 w-11 place-items-center rounded-[10px] text-faint"
                >
                  <X className="size-6" />
                </button>
              </div>

              {form === "lorry" ? (
                <div className="grid grid-cols-[1fr_1.1fr] items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex h-7 items-center justify-between">
                      <span className="text-xs font-bold text-muted">PLT TYPE</span>
                      {prev && !samePltType(prev, p) ? (
                        <button
                          type="button"
                          aria-label="PLT type same as above"
                          title="PLT type same as above"
                          onClick={() =>
                            setPallet(i, (pl) => {
                              pl.pltType = prev.pltType;
                              pl.pltOther = prev.pltOther ?? "";
                            })
                          }
                          className="flex h-7 items-center gap-0.5 rounded-[7px] bg-canvas px-1.5 text-[11px] font-bold text-primary"
                        >
                          <ArrowUp aria-hidden className="size-3.5" strokeWidth={2.5} />
                          same
                        </button>
                      ) : null}
                    </div>
                    <PltTypeButtons
                      size="sm"
                      value={p.pltType}
                      other={p.pltOther ?? ""}
                      onChange={(t) => setPallet(i, (pl) => void (pl.pltType = t))}
                      onOther={(v) => setPallet(i, (pl) => void (pl.pltOther = v))}
                    />
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="flex h-7 items-center text-xs font-bold text-muted">CONTRACT NO</span>
                    <input
                      value={p.contractNo}
                      autoComplete="off"
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        setPallet(i, (pl) => void (pl.contractNo = v));
                      }}
                      className="h-12 w-full rounded-[9px] border-[1.5px] border-field bg-surface px-2.5 text-[15px] font-semibold text-ink uppercase outline-none focus:border-primary"
                    />
                  </label>
                </div>
              ) : null}

              {p.lines.map((l, j) => (
                <LineFields
                  key={j}
                  line={l}
                  index={j}
                  unit={item.unit}
                  mixed={mixed}
                  hasPrev={!!prev}
                  onSet={(field, value) => setPallet(i, (pl) => void (pl.lines[j][field] = value))}
                  onCopy={(field) =>
                    setPallet(i, (pl, all) => {
                      const source = previousPallet(all, itemIndex, i);
                      if (!source) return;
                      pl.lines[j][field] = (source.lines[j] ?? source.lines[0])[field];
                    })
                  }
                  onRemove={() => setPallet(i, (pl) => void pl.lines.splice(j, 1))}
                />
              ))}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={p.lines.length >= MAX_LINES_PER_PALLET}
                  onClick={() => setPallet(i, (pl) => void pl.lines.push(blankLine()))}
                  className="flex h-12 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-primary text-[15px] font-bold text-primary disabled:opacity-40"
                >
                  + Add batch
                </button>
                <input
                  value={p.remark}
                  placeholder="Remark"
                  aria-label={`Pallet ${no} remark`}
                  autoComplete="off"
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().slice(0, 60);
                    setPallet(i, (pl) => void (pl.remark = v));
                  }}
                  className="h-12 w-full rounded-[10px] border-[1.5px] border-field bg-surface-sunken px-3 text-[15px] font-semibold text-ink uppercase outline-none focus:border-primary focus:bg-surface"
                />
              </div>
            </div>
          );
        })}
        {item.pallets.length === 0 ? <div className="px-4 py-8 text-center text-base font-semibold text-muted">No pallets. Tap + Pallet.</div> : null}
      </Scroll>
      <BottomBar className="grid grid-cols-[1fr_1.4fr] gap-2.5">
        <Button
          variant="secondary"
          className="text-base"
          disabled={items.reduce((n, it) => n + it.pallets.length, 0) >= MAX_PALLETS}
          title={`A sheet holds ${MAX_PALLETS} pallets`}
          onClick={() =>
            onUpdate((it, all) => {
              const last = it.pallets[it.pallets.length - 1] ?? previousPallet(all, itemIndex, 0);
              it.pallets.push({
                id: newId(),
                pltType: last?.pltType ?? "L4",
                pltOther: last?.pltOther ?? "",
                contractNo: last?.contractNo ?? "",
                remark: "",
                lines: [blankLine()],
              });
            })
          }
        >
          + Pallet
        </Button>
        <Button onClick={onSave}>{saveLabel}</Button>
      </BottomBar>
    </>
  );
}
