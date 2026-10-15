"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_UNITS } from "@/lib/tally/constants";
import { suggestItems, type ItemSuggestion, type PickState } from "../pick";
import { BottomBar, Button, Scroll, SectionLabel, TextField } from "../ui";

/**
 * Step 4: the worker types the item name. Names used before (on any
 * worker's submitted sheets, plus this phone's own recent ones) are
 * suggested as they type; tapping one fills the name, unit and qty per
 * pallet.
 */
export function ItemNameScreen({
  pick,
  history,
  onName,
  onUnit,
  onSuggestion,
  onNext,
}: {
  pick: PickState;
  history: ItemSuggestion[];
  onName: (name: string) => void;
  onUnit: (unit: string) => void;
  onSuggestion: (s: ItemSuggestion) => void;
  onNext: () => void;
}) {
  const suggestions = suggestItems(pick.name, history);
  const typed = pick.name.trim().length > 0;
  const customUnit = !(QUICK_UNITS as readonly string[]).includes(pick.unit);

  return (
    <>
      <div className="flex flex-none flex-col gap-3 border-b border-line bg-surface px-4 pt-3 pb-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-body">Item name</span>
          <TextField
            autoFocus
            upper
            value={pick.name}
            onChange={(e) => onName(e.target.value.toUpperCase().slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed) onNext();
            }}
            placeholder="Type the item, e.g. MARGARINE 5KG"
            enterKeyHint="next"
            className="text-lg"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-body">Unit for QTY</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Unit">
            {QUICK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={pick.unit === u}
                onClick={() => onUnit(u)}
                className={cn(
                  "h-12 min-w-[72px] rounded-[10px] px-4 text-lg font-bold",
                  pick.unit === u ? "bg-primary text-white" : "border-[1.5px] border-field bg-surface text-ink",
                )}
              >
                {u}
              </button>
            ))}
            <input
              value={customUnit ? pick.unit : ""}
              onChange={(e) => onUnit(e.target.value.toUpperCase().replace(/[^A-Z0-9 .]/g, "").slice(0, 10))}
              placeholder="Other"
              aria-label="Other unit"
              className={cn(
                "h-12 min-w-0 flex-1 rounded-[10px] bg-surface px-3 text-lg font-bold text-ink uppercase outline-none focus:border-2 focus:border-primary",
                customUnit && pick.unit ? "border-2 border-primary" : "border-[1.5px] border-field",
              )}
            />
          </div>
        </div>
      </div>

      <Scroll>
        {suggestions.length > 0 ? (
          <>
            <SectionLabel className="px-4 pt-3.5 pb-1.5">{typed ? "Used before" : "Recently used"}</SectionLabel>
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => onSuggestion(s)}
                className="flex min-h-16 w-full items-center gap-3 border-b border-line-soft bg-surface px-4 py-2 text-left active:bg-primary-soft"
              >
                <History className="size-5 flex-none text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-bold">{s.name}</div>
                  <div className="text-[13px] font-medium text-muted">
                    {[s.unit, s.qtyPerPallet ? `${s.qtyPerPallet} ${s.unit}/pallet` : null, s.useCount > 1 ? `used ${s.useCount}×` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </button>
            ))}
          </>
        ) : (
          <div className="px-4 py-6 text-[15px] font-medium text-muted">
            {typed ? "New item. It will be saved to the history when the sheet is submitted." : "No items used yet. Type the item name above."}
          </div>
        )}
      </Scroll>

      <BottomBar>
        <Button className="w-full" disabled={!typed} onClick={onNext}>
          Next · Pallets
        </Button>
      </BottomBar>
    </>
  );
}
