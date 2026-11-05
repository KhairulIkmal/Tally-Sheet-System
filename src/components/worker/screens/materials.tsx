"use client";

import { cn } from "@/lib/utils";
import { CHECKS, MATERIALS, MATERIALS_FIRST_BOXES, PLT_TYPES, type CheckKey, type MaterialKey, type PltType } from "@/lib/tally/constants";
import { autoPltCounts, pltCounts, totals, type Draft } from "@/lib/tally/draft";
import { PLT_LABELS } from "@/lib/tally/sheet";
import { BottomBar, Button, Scroll } from "../ui";
import { RuledRemarkInput } from "./paper-footer";

const toCount = (v: string) => Math.min(9999, parseInt(v.replace(/\D/g, ""), 10) || 0);

const countBox =
  "h-12 w-full min-w-0 bg-transparent text-center text-xl font-extrabold text-ink outline-none placeholder:text-[11px] placeholder:font-bold placeholder:text-placeholder focus:bg-primary-soft";

/** The foot of the paper form on a phone: same boxes, same names, same order, filled in by typing the count. */
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
  onPltAdjust: (k: PltType, delta: number) => void;
  onRemark: (v: string) => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  const isContainer = draft.form === "container";
  const counts = pltCounts(draft);
  const auto = autoPltCounts(draft.items);
  const pltSum = Object.values(counts).reduce((a, b) => a + b, 0);
  const pallets = totals(draft.items).pallets;

  const boxes = (keys: readonly MaterialKey[]) => (
    <div className="flex flex-col border-2 border-ink bg-surface">
      {keys.map((k) => {
        const v = draft.materials[k] ?? 0;
        return (
          <label key={k} className="grid grid-cols-[minmax(0,1fr)_56px] items-stretch border-b border-ink/60 last:border-b-0">
            <span className="flex items-center border-r border-ink/60 px-2 text-xs leading-tight font-bold text-ink">{k}</span>
            <input
              value={v ? String(v) : ""}
              inputMode="numeric"
              aria-label={k}
              className={countBox}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onMaterial(k, toCount(e.target.value) - v)}
            />
          </label>
        );
      })}
    </div>
  );

  return (
    <>
      <Scroll className="gap-5 px-4 pt-4 pb-5">
        {isContainer ? (
          <>
            <RuledRemarkInput label="REMARKS" value={draft.remark} onChange={onRemark} />
            {/* Two sets of boxes, level at the bottom, as printed. */}
            <div className="grid grid-cols-2 items-end gap-3">
              {boxes(MATERIALS.slice(0, MATERIALS_FIRST_BOXES))}
              {boxes(MATERIALS.slice(MATERIALS_FIRST_BOXES))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {CHECKS.map((k) => {
                const c = draft.checks[k];
                return (
                  <div key={k} className="grid grid-cols-[84px_10px_60px_minmax(0,1fr)] items-end gap-x-1 text-xs font-bold text-ink">
                    <span className="pb-3">{k}</span>
                    <span className="pb-3">:</span>
                    <input
                      value={c.qty ? String(c.qty) : ""}
                      inputMode="numeric"
                      placeholder="CTN"
                      aria-label={`${k} CTN`}
                      className={cn(countBox, "border-2 border-ink bg-surface")}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onCheck(k, { qty: toCount(e.target.value) })}
                    />
                    <input
                      value={c.note}
                      aria-label={`${k} note`}
                      className="ml-1.5 h-10 w-[calc(100%-6px)] min-w-0 border-b-2 border-ink/40 bg-transparent px-1 text-[15px] font-semibold uppercase outline-none focus:border-primary focus:bg-primary-soft"
                      onChange={(e) => onCheck(k, { note: e.target.value.slice(0, 60) })}
                    />
                  </div>
                );
              })}
              <RuledRemarkInput label="REMARK" value={draft.remark} onChange={onRemark} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-right text-xs font-bold text-ink">TOTAL NUMBER OF PLT</div>
              {PLT_TYPES.map((k) => (
                <label key={k} className="grid grid-cols-[minmax(0,1fr)_84px] border-2 border-ink bg-surface">
                  <span className="flex items-center border-r-2 border-ink px-2.5 text-[13px] font-bold text-ink">{PLT_LABELS[k]}</span>
                  <input
                    value={String(counts[k])}
                    inputMode="numeric"
                    aria-label={PLT_LABELS[k]}
                    className={cn(countBox, counts[k] !== auto[k] && "text-warning")}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onPltAdjust(k, toCount(e.target.value) - counts[k])}
                  />
                </label>
              ))}
              <div className={cn("mt-0.5 text-right text-[13px] font-bold", pltSum === pallets ? "text-success" : "text-warning")}>
                {pltSum === pallets ? `${pltSum} PLT ✓ matches the pallets` : `${pltSum} PLT · actual pallets ${pallets}`}
              </div>
              {PLT_TYPES.some((k) => counts[k] !== auto[k]) ? (
                <div className="text-[13px] font-medium text-muted">
                  Counted: {PLT_TYPES.map((k) => `${k} ${auto[k]}`).join(" · ")}. You changed the totals by hand.
                </div>
              ) : null}
            </div>
          </>
        )}
      </Scroll>
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          {nextLabel}
        </Button>
      </BottomBar>
    </>
  );
}
