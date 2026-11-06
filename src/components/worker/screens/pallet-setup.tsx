"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PLT_GROUPS,
  PLT_OTHER_MAX,
  pltCellText,
  pltGroup,
  type PltChoice,
  type PltGroup,
  type PltType,
  type SheetForm,
  MAX_PALLETS,
} from "@/lib/tally/constants";
import type { PickState } from "../pick";
import { BottomBar, Button, PalletBadge, Scroll, TextField } from "../ui";

const WAYS: { type: PltType; label: string }[] = [
  { type: "L4", label: "4-WAY" },
  { type: "L2", label: "2-WAY" },
];
const GROUP_TYPE: Record<Exclude<PltGroup, "L">, PltType> = { E: "E", C: "C", O: "O" };

/** Asks what kind of pallet an Others pallet is. */
export function PltOtherInput({
  value,
  onChange,
  autoFocus,
  label = "Type of pallet",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      autoFocus={autoFocus}
      autoComplete="off"
      enterKeyHint="done"
      maxLength={PLT_OTHER_MAX}
      placeholder="Type of pallet"
      aria-label={label}
      onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, PLT_OTHER_MAX))}
      // The keyboard's ✓ (Enter): done typing, so the keyboard goes away.
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
      className={cn(
        "w-full min-w-0 rounded-[9px] border-[1.5px] border-primary bg-surface px-2.5 text-[15px] font-semibold text-ink uppercase outline-none placeholder:font-medium placeholder:normal-case focus:border-2",
        className,
      )}
    />
  );
}

/**
 * L, E, C, O as on the paper form. A Lam Soon pallet then says which way, 4-way or 2-way,
 * and choosing Others asks straight away what kind of pallet it is.
 */
export function PltTypeButtons({
  value,
  other,
  onChange,
  onOther,
  size = "md",
}: {
  /** "" when none has been chosen yet: no button is lit. */
  value: PltChoice;
  other: string;
  onChange: (t: PltType) => void;
  onOther: (v: string) => void;
  size?: "md" | "sm";
}) {
  const group = pltGroup(value);
  // Only a tap on O brings the keyboard up, not opening a screen that already has an Others pallet.
  const [justChoseOther, setJustChoseOther] = useState(false);
  const gap = size === "md" ? "gap-1" : "gap-[3px]";
  const choice = (selected: boolean) =>
    selected ? "bg-primary text-white dark:text-[#0e1115]" : "border-[1.5px] border-field bg-surface text-ink";
  return (
    <div className={cn("flex flex-col", gap)}>
      <div className={cn("grid grid-cols-4", gap)} role="radiogroup" aria-label="PLT type">
        {PLT_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={group === g}
            onClick={() => {
              setJustChoseOther(g === "O");
              // L keeps the way already chosen, else starts on 4-WAY.
              onChange(g === "L" ? (value === "L4" || value === "L2" ? value : "L4") : GROUP_TYPE[g]);
            }}
            className={cn(
              "flex items-center justify-center rounded-[9px] font-bold",
              size === "md" ? "h-[52px] text-xl" : "h-12 text-[17px]",
              choice(group === g),
            )}
          >
            {g}
          </button>
        ))}
      </div>
      {group === "L" ? (
        <div className={cn("grid grid-cols-2", gap)} role="radiogroup" aria-label="Lam Soon pallet">
          {WAYS.map((w) => (
            <button
              key={w.type}
              type="button"
              role="radio"
              aria-checked={value === w.type}
              onClick={() => onChange(w.type)}
              className={cn("flex h-10 items-center justify-center rounded-[9px] text-[13px] font-bold", choice(value === w.type))}
            >
              {w.label}
            </button>
          ))}
        </div>
      ) : null}
      {value === "O" ? <PltOtherInput value={other} onChange={onOther} autoFocus={justChoseOther} className="h-10" /> : null}
    </div>
  );
}

function NumberBox({
  label,
  value,
  placeholder,
  onChange,
  note,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  /** A small line under the box. */
  note?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-body">{label}</span>
      <TextField
        big
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
        className="rounded-xl"
      />
      {note ? <span className="text-xs font-semibold text-muted">{note}</span> : null}
    </label>
  );
}

/** The note under "per pallet" while it still holds the value filled in from the item's history. */
export function historyNote(per: string, fromHistory: string | undefined): string | undefined {
  return per && per === fromHistory ? "Auto-filled from this item's history. Change it if this load is different." : undefined;
}

export function PalletSetupScreen({
  form,
  pick,
  qtys,
  room,
  nextStart,
  onChange,
  onCreate,
}: {
  form: SheetForm;
  pick: PickState;
  /** Preview of the pallets that will be created ("" = qty to fill later). */
  qtys: (number | "")[];
  /** Pallets the sheet still has space for. */
  room: number;
  nextStart: number;
  onChange: (patch: Partial<PickState>) => void;
  onCreate: () => void;
}) {
  const per = parseInt(pick.per, 10) || 0;
  const unit = pick.unit || "CTN";
  const total = parseInt(pick.total, 10) || 0;
  const count = qtys.length;
  // The split the total asks for, before the sheet's limit.
  const wanted = per > 0 && total > 0 ? Math.floor(total / per) + (total % per ? 1 : 0) : count;
  const cutShort = wanted > count;
  const left = cutShort ? total - qtys.reduce<number>((a, q) => a + (q || 0), 0) : 0;
  const range = count ? `Pallet ${nextStart}${count > 1 ? `–${nextStart + count - 1}` : ""}` : `Starts at Pallet ${nextStart}`;

  return (
    <>
      <Scroll className="gap-3 px-4 py-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <NumberBox label={`Total ${unit} (optional)`} value={pick.total} placeholder="150" onChange={(v) => onChange({ total: v })} />
          <NumberBox
            label={`${unit} per pallet (optional)`}
            value={pick.per}
            placeholder="32"
            onChange={(v) => onChange({ per: v })}
            note={historyNote(pick.per, pick.perFromHistory)}
          />
        </div>
        {!total ? (
          <div className="rounded-[10px] bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary">
            No total: 1 pallet is started{per ? ` with ${per} ${unit}` : ""}. Add more with + Pallet on the next screen. The TOTAL is what
            the pallets add up to.
          </div>
        ) : null}
        {total > 0 && !per ? (
          <div className="rounded-[10px] bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary">
            No qty per pallet: 1 pallet is started. On the next screen type each pallet&apos;s qty and add more with + Pallet. The total is
            checked against {total} {unit}.
          </div>
        ) : null}

        {room < 1 ? (
          <div
            role="alert"
            className="rounded-[10px] border border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm font-semibold text-danger-ink"
          >
            This sheet is full: {MAX_PALLETS} pallets. Start a new sheet for more.
          </div>
        ) : cutShort ? (
          <div
            role="alert"
            className="rounded-[10px] border border-warning-border bg-warning-bg px-3.5 py-2.5 text-sm font-semibold text-warning-ink"
          >
            A sheet holds {MAX_PALLETS} pallets, so only {count} fit here (up to Pallet {MAX_PALLETS}). The other {left} {unit} go on a new
            sheet.
          </div>
        ) : null}

        {form === "lorry" ? (
          <div className="grid grid-cols-[1fr_1.2fr] items-start gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-body">PLT Type (default)</span>
              <PltTypeButtons
                value={pick.pltType}
                other={pick.pltOther}
                onChange={(t) => onChange({ pltType: t })}
                onOther={(v) => onChange({ pltOther: v })}
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-body">Contract No</span>
              <TextField
                upper
                value={pick.contractNo}
                onChange={(e) => onChange({ contractNo: e.target.value.toUpperCase() })}
                className="h-[52px] text-[17px]"
              />
            </label>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="flex items-baseline justify-between border-b border-line-soft px-3.5 py-3">
            <span className="text-[15px] font-bold">
              {count ? `${count} pallet${count === 1 ? "" : "s"} will be created` : `Enter the total ${unit} to see the pallets`}
            </span>
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
                <span className="min-w-4 text-center text-[13px] font-bold text-muted">
                  {form === "lorry" ? pltCellText(pick.pltType, pick.pltOther) || "—" : ""}
                </span>
                <span className="min-w-14 text-right text-xl font-bold">{q === "" ? "—" : q}</span>
              </div>
            );
          })}
          {/* Checked against the total only when there is one. */}
          {per > 0 && total > 0 && count > 0 ? (
            <div className="flex justify-between bg-success-bg px-3.5 py-2.5 text-base font-bold text-success">
              <span>Total</span>
              <span>
                {total - left} / {total} {unit} {cutShort ? "" : "✓"}
                {count > 12 ? ` (${count - 12} more)` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </Scroll>
      <BottomBar>
        <Button className="w-full" disabled={!count} onClick={onCreate}>
          {count ? `Create ${count} pallet${count === 1 ? "" : "s"}` : `This sheet is full`}
        </Button>
      </BottomBar>
    </>
  );
}
