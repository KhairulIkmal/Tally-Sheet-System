"use client";

import { cn } from "@/lib/utils";
import { PLT_TYPES, type PltType, type SheetForm } from "@/lib/tally/constants";
import type { PickState } from "../pick";
import { BottomBar, Button, PalletBadge, Scroll, TextField } from "../ui";

export function PltTypeButtons({ value, onChange, size = "md" }: { value: PltType; onChange: (t: PltType) => void; size?: "md" | "sm" }) {
  return (
    <div className={cn("grid grid-cols-4", size === "md" ? "gap-1" : "gap-[3px]")} role="radiogroup" aria-label="PLT type">
      {PLT_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "flex items-center justify-center rounded-[9px] font-bold",
            size === "md" ? "h-[52px] text-xl" : "h-12 text-[17px]",
            value === t ? "bg-primary text-white dark:text-[#0e1115]" : "border-[1.5px] border-field bg-surface text-ink",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function NumberBox({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-body">{label}</span>
      <TextField big inputMode="numeric" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-xl" />
    </label>
  );
}

export function PalletSetupScreen({
  form,
  pick,
  qtys,
  nextStart,
  onChange,
  onCreate,
}: {
  form: SheetForm;
  pick: PickState;
  /** Preview of the pallets that will be created ("" = qty to fill later). */
  qtys: (number | "")[];
  nextStart: number;
  onChange: (patch: Partial<PickState>) => void;
  onCreate: () => void;
}) {
  const per = parseInt(pick.per, 10) || 0;
  const total = parseInt(pick.total, 10) || 0;
  const count = qtys.length;
  const range = count ? `Pallet ${nextStart}${count > 1 ? `–${nextStart + count - 1}` : ""}` : `Starts at Pallet ${nextStart}`;

  return (
    <>
      <Scroll className="gap-3 px-4 py-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-line p-1" role="tablist">
          {(
            [
              ["auto", "From total CTN"],
              ["manual", "Number of pallets"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={pick.mode === mode}
              onClick={() => onChange({ mode })}
              className={cn("h-11 rounded-[9px] text-[15px] font-bold", pick.mode === mode ? "bg-surface text-ink" : "text-muted")}
            >
              {label}
            </button>
          ))}
        </div>

        {pick.mode === "auto" ? (
          <div className="grid grid-cols-2 gap-2.5">
            <NumberBox label="Total CTN" value={pick.total} placeholder="150" onChange={(v) => onChange({ total: v })} />
            <NumberBox label="CTN per pallet" value={pick.per} placeholder="32" onChange={(v) => onChange({ per: v })} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <NumberBox label="Number of pallets" value={pick.count} placeholder="5" onChange={(v) => onChange({ count: v.slice(0, 3) })} />
              <NumberBox label="Total CTN (optional)" value={pick.total} placeholder="—" onChange={(v) => onChange({ total: v })} />
            </div>
            <div className="text-sm font-medium text-muted">You fill in the qty for each pallet.</div>
          </>
        )}

        {form === "lorry" ? (
          <div className="grid grid-cols-[1fr_1.2fr] gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-body">PLT Type (default)</span>
              <PltTypeButtons value={pick.pltType} onChange={(t) => onChange({ pltType: t })} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-body">Contract No</span>
              <TextField upper value={pick.contractNo} onChange={(e) => onChange({ contractNo: e.target.value.toUpperCase() })} className="h-[52px] text-[17px]" />
            </label>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="flex items-baseline justify-between border-b border-line-soft px-3.5 py-3">
            <span className="text-[15px] font-bold">{count ? `${count} pallet${count === 1 ? "" : "s"} will be created` : "Enter the numbers to see the pallets"}</span>
            <span className="text-sm font-semibold text-muted">{range}</span>
          </div>
          {qtys.slice(0, 12).map((q, i) => {
            const partial = q !== "" && per > 0 && q < per;
            return (
              <div key={i} className="grid h-12 grid-cols-[52px_1fr_auto_auto] items-center gap-2.5 border-b border-line-soft px-3.5">
                <PalletBadge no={nextStart + i} />
                <span className={cn("text-sm font-medium", partial ? "text-warning" : "text-muted")}>
                  {q === "" ? "Fill qty later" : partial ? "Remainder · not full" : "Full"}
                </span>
                <span className="min-w-4 text-center text-[13px] font-bold text-muted">{form === "lorry" ? pick.pltType : ""}</span>
                <span className="min-w-14 text-right text-xl font-bold">{q === "" ? "—" : q}</span>
              </div>
            );
          })}
          {pick.mode === "auto" && count > 0 ? (
            <div className="flex justify-between bg-success-bg px-3.5 py-2.5 text-base font-bold text-success">
              <span>Total</span>
              <span>
                {total} / {total} CTN ✓{count > 12 ? ` (${count - 12} more)` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </Scroll>
      <BottomBar>
        <Button className="w-full" disabled={!count} onClick={onCreate}>
          {count ? `Create ${count} pallet${count === 1 ? "" : "s"}` : "Create pallets"}
        </Button>
      </BottomBar>
    </>
  );
}
