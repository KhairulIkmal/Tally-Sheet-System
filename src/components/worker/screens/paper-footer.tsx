"use client";

import { cn } from "@/lib/utils";
import { CHECKS, MATERIALS, PLT_TYPES } from "@/lib/tally/constants";
import { PLT_LABELS } from "@/lib/tally/sheet";
import { autoPltCounts, pltCounts, totals, type Draft } from "@/lib/tally/draft";

const box =
  "h-10 w-full min-w-0 bg-transparent text-center text-[17px] font-extrabold outline-none placeholder:text-placeholder focus:bg-primary-soft";
const lineInput =
  "h-9 w-full min-w-0 border-b-2 border-ink/40 bg-transparent px-1 text-[15px] font-semibold uppercase outline-none focus:border-primary focus:bg-primary-soft";

const toCount = (v: string) => Math.min(9999, parseInt(v.replace(/\D/g, ""), 10) || 0);

/**
 * The bottom of the paper form, laid out as printed: packing-material boxes
 * and remarks (container), or Sample / Empty CTN / Others, remark and the
 * PLT totals (lorry), then "Count & prepared by". Edits the same draft fields
 * as the step-by-step materials screen.
 */
export function PaperFooter({ draft, signerName, onEdit }: { draft: Draft; signerName: string; onEdit: (fn: (d: Draft) => void) => void }) {
  const signature = (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold">COUNT &amp; PREPARED BY :</span>
      <div className="flex h-14 items-end pl-3">
        {draft.signature ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL signature
          <img src={draft.signature} alt="Signature" className="h-12 max-w-[230px] object-contain object-left-bottom" />
        ) : (
          <span className="pb-1 text-xs font-medium text-muted">Signed after the review</span>
        )}
      </div>
      <div className="w-[230px] border-b-2 border-dotted border-ink" />
      <span className="text-xs font-medium">{signerName}</span>
    </div>
  );

  const remark = (label: string) => (
    <label className="grid grid-cols-[84px_10px_1fr] items-end text-xs font-bold">
      <span className="pb-1.5">{label}</span>
      <span className="pb-1.5">:</span>
      <input
        value={draft.remark}
        aria-label={label}
        className={lineInput}
        onChange={(e) => {
          const v = e.target.value.slice(0, 300);
          onEdit((d) => void (d.remark = v));
        }}
      />
    </label>
  );

  if (draft.form === "container") {
    return (
      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          {remark("REMARKS")}
          {signature}
        </div>
        <div className="grid grid-cols-2 content-start gap-x-2.5 gap-y-1.5">
          {MATERIALS.map((k) => {
            const v = draft.materials[k] ?? 0;
            return (
              <label key={k} className="grid grid-cols-[1fr_56px] items-stretch border border-ink/60">
                <span className="flex items-center border-r border-ink/60 px-2 text-[11px] font-bold">{k}</span>
                <input
                  value={v ? String(v) : ""}
                  inputMode="numeric"
                  aria-label={k}
                  className={box}
                  onChange={(e) => {
                    const n = toCount(e.target.value);
                    onEdit((d) => void (d.materials[k] = n));
                  }}
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  const counts = pltCounts(draft);
  const auto = autoPltCounts(draft.items);
  const pltSum = PLT_TYPES.reduce((a, k) => a + counts[k], 0);
  const pallets = totals(draft.items).pallets;
  return (
    <div className="mt-5 flex flex-col gap-5">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-2 sm:pt-6">
          {CHECKS.map((k) => {
            const c = draft.checks[k];
            return (
              <div key={k} className="grid grid-cols-[84px_10px_56px_1fr] items-end gap-x-1 text-xs font-bold">
                <span className="pb-2">{k}</span>
                <span className="pb-2">:</span>
                <input
                  value={c.qty ? String(c.qty) : ""}
                  inputMode="numeric"
                  aria-label={`${k} CTN`}
                  placeholder="CTN"
                  className={cn(box, "h-9 border-2 border-ink text-[15px] placeholder:text-[11px] placeholder:font-bold")}
                  onChange={(e) => {
                    const n = toCount(e.target.value);
                    onEdit((d) => void (d.checks[k] = { ...d.checks[k], qty: n }));
                  }}
                />
                <input
                  value={c.note}
                  aria-label={`${k} note`}
                  className={cn(lineInput, "ml-2")}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 60);
                    onEdit((d) => void (d.checks[k] = { ...d.checks[k], note: v }));
                  }}
                />
              </div>
            );
          })}
          <div className="mt-1">{remark("REMARK")}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="mb-0.5 text-right text-xs font-bold">TOTAL NUMBER OF PLT</div>
          {PLT_TYPES.map((k) => (
            <label key={k} className="grid grid-cols-[1fr_72px] border-2 border-ink">
              <span className="flex items-center border-r-2 border-ink px-2 text-[11px] font-bold">{PLT_LABELS[k]}</span>
              <input
                value={String(counts[k])}
                inputMode="numeric"
                aria-label={PLT_LABELS[k]}
                className={cn(box, "h-9", counts[k] !== auto[k] && "text-warning")}
                onChange={(e) => {
                  // Stored as a correction on top of the count worked out from the rows.
                  const n = toCount(e.target.value);
                  onEdit((d) => void (d.pltAdjust[k] = n - auto[k]));
                }}
              />
            </label>
          ))}
          <div className={cn("mt-1 text-right text-xs font-bold", pltSum === pallets ? "text-success" : "text-warning")}>
            {pltSum === pallets ? `${pltSum} PLT ✓ matches the rows` : `${pltSum} PLT · ${pallets} rows filled`}
          </div>
        </div>
      </div>
      {signature}
    </div>
  );
}
