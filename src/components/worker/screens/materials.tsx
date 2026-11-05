"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECKS, MATERIALS, MATERIALS_FIRST_BOXES, PLT_GROUP_NAMES, PLT_GROUPS, lamSoonWayList, materialLabel, otherPalletList, type CheckKey, type MaterialKey, type PltGroup } from "@/lib/tally/constants";
import { autoPltCounts, pltCounts, totals, type Draft } from "@/lib/tally/draft";
import { BottomBar, Button, Scroll, TextField } from "../ui";


/** The count between − and +: tap it and type. */
function CountInput({ value, onChange, label, className }: { value: number; onChange: (n: number) => void; label: string; className?: string }) {
  return (
    <input
      value={value ? String(value) : ""}
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="0"
      aria-label={`${label} count`}
      className={cn(
        "h-12 min-w-0 flex-none rounded-[10px] border-[1.5px] border-field bg-surface text-center text-[22px] font-extrabold text-ink outline-none placeholder:text-placeholder focus:border-2 focus:border-primary",
        className,
      )}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(Math.min(9999, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
    />
  );
}

function Stepper({
  value,
  onDec,
  onInc,
  onSet,
  label,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  onSet: (n: number) => void;
  label: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Less ${label}`}
        onClick={onDec}
        disabled={value === 0}
        className="grid h-12 w-[52px] place-items-center rounded-[10px] border-[1.5px] border-field bg-surface disabled:opacity-40"
      >
        <Minus className="size-6" />
      </button>
      <CountInput value={value} label={label} onChange={onSet} className="w-14" />
      <button type="button" aria-label={`More ${label}`} onClick={onInc} className="grid h-12 w-[52px] place-items-center rounded-[10px] bg-primary text-white dark:text-[#0e1115]">
        <Plus className="size-6" />
      </button>
    </>
  );
}

export function MaterialsScreen({
  draft,
  onMaterial,
  onCheck,
  onPltAdjust,
  onRemark,
  onNext,
  nextLabel = "Next · Review",
}: {
  draft: Draft;
  onMaterial: (k: MaterialKey, delta: number) => void;
  onCheck: (k: CheckKey, patch: Partial<{ qty: number; note: string }>) => void;
  onPltAdjust: (k: PltGroup, delta: number) => void;
  onRemark: (v: string) => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  const isContainer = draft.form === "container";
  const counts = pltCounts(draft);
  const auto = autoPltCounts(draft.items);
  const allPallets = draft.items.flatMap((it) => it.pallets);
  const notes: Partial<Record<PltGroup, string>> = { L: lamSoonWayList(allPallets), O: otherPalletList(allPallets) };
  const pltSum = Object.values(counts).reduce((a, b) => a + b, 0);
  const pallets = totals(draft.items).pallets;

  return (
    <>
      <Scroll className="gap-2.5 px-4 pt-2.5 pb-4">
        {isContainer ? (
          // The same two sets as the boxes on the paper form.
          [MATERIALS.slice(0, MATERIALS_FIRST_BOXES), MATERIALS.slice(MATERIALS_FIRST_BOXES)].map((group) => (
            <div key={group[0]} className="flex flex-col rounded-[14px] border border-line bg-surface px-3">
              {group.map((k) => (
                <div key={k} className="flex h-[60px] items-center gap-2 border-b border-line-soft last:border-b-0">
                  <span className="flex-1 text-[17px] font-bold">{materialLabel(k)}</span>
                  <Stepper
                    value={draft.materials[k] ?? 0}
                    label={materialLabel(k)}
                    onDec={() => onMaterial(k, -1)}
                    onInc={() => onMaterial(k, 1)}
                    onSet={(n) => onMaterial(k, n - (draft.materials[k] ?? 0))}
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="rounded-[14px] border border-line bg-surface px-3 py-1">
            <div className="flex gap-3 pt-2 text-xs font-bold tracking-[.04em] text-muted">
              <span className="w-[92px]" />
              <span className="w-[72px] text-center">CTN</span>
              <span>NOTE</span>
            </div>
            {CHECKS.map((k) => {
              const c = draft.checks[k];
              return (
                <div key={k} className="flex min-h-[64px] items-center gap-3 border-b border-line-soft last:border-b-0">
                  <span className="w-[92px] flex-none text-[17px] font-bold">{materialLabel(k)}</span>
                  <input
                    value={c.qty ? String(c.qty) : ""}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`${materialLabel(k)} CTN`}
                    onChange={(e) => onCheck(k, { qty: Math.min(9999, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })}
                    className={cn(
                      "h-12 w-[72px] flex-none rounded-lg border-[1.5px] bg-surface text-center text-[22px] font-extrabold text-ink outline-none focus:border-2 focus:border-primary",
                      c.qty ? "border-primary" : "border-field",
                    )}
                  />
                  <input
                    value={c.note}
                    placeholder={k === "SAMPLE" ? "e.g. for QA/QC" : "Note"}
                    aria-label={`${materialLabel(k)} note`}
                    onChange={(e) => onCheck(k, { note: e.target.value.slice(0, 60) })}
                    className="h-11 min-w-0 flex-1 rounded-lg border-[1.5px] border-line bg-canvas px-2.5 text-[15px] font-semibold text-ink outline-none focus:border-primary focus:bg-surface"
                  />
                </div>
              );
            })}
          </div>
        )}

        <label className="mt-1 flex flex-col gap-1.5">
          <span className="text-sm font-bold text-body">{isContainer ? "Remarks" : "Remark"}</span>
          <TextField value={draft.remark} onChange={(e) => onRemark(e.target.value.slice(0, 300))} placeholder="Optional" className="h-[52px] text-base" />
        </label>

        {!isContainer ? (
          <>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-sm font-bold tracking-[.04em] text-body">TOTAL NUMBER OF PLT</span>
              <span className="text-[13px] font-semibold text-primary">Counted from the pallets</span>
            </div>
            <div className="rounded-[14px] border border-line bg-surface px-3">
              {PLT_GROUPS.map((k) => (
                <div key={k} className="flex min-h-[58px] items-center gap-2 border-b border-line-soft py-1">
                  <span className="grid size-9 place-items-center rounded-lg bg-chip text-lg font-extrabold">{k}</span>
                  <span className="flex min-w-0 flex-1 flex-col text-base leading-tight font-semibold">
                    {PLT_GROUP_NAMES[k]}
                    {notes[k] ? <span className="text-xs font-semibold text-muted">{notes[k]}</span> : null}
                  </span>
                  <button
                    type="button"
                    aria-label={`Less ${PLT_GROUP_NAMES[k]}`}
                    onClick={() => onPltAdjust(k, -1)}
                    disabled={counts[k] === 0}
                    className="grid h-11 w-12 place-items-center rounded-[9px] border-[1.5px] border-field disabled:opacity-40"
                  >
                    <Minus className="size-5" />
                  </button>
                  <CountInput value={counts[k]} label={PLT_GROUP_NAMES[k]} onChange={(n) => onPltAdjust(k, n - counts[k])} className="h-11 w-12" />
                  <button
                    type="button"
                    aria-label={`More ${PLT_GROUP_NAMES[k]}`}
                    onClick={() => onPltAdjust(k, 1)}
                    className="grid h-11 w-12 place-items-center rounded-[9px] border-[1.5px] border-field"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              ))}
              <div className={cn("flex min-h-12 items-center justify-between text-base font-extrabold", pltSum === pallets ? "text-success" : "text-warning")}>
                <span>Total</span>
                <span>{pltSum === pallets ? `${pltSum} PLT ✓ matches the pallets` : `${pltSum} PLT · actual pallets ${pallets}`}</span>
              </div>
              {PLT_GROUPS.some((k) => counts[k] !== auto[k]) ? (
                <div className="pb-2.5 text-[13px] font-medium text-muted">
                  Counted: {PLT_GROUPS.map((k) => `${k} ${auto[k]}`).join(" · ")}. You changed the totals by hand.
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </Scroll>
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          {nextLabel}
        </Button>
      </BottomBar>
    </>
  );
}
