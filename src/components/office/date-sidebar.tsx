"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, addMonths, monthGrid, monthLabel, rangeLabel } from "@/lib/data/filters";
import type { KlDate, SheetFilter } from "@/lib/data/types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Form = "container" | "lorry";

/** "all" when both or neither are on, else the one that is. */
export function toggleOne<T extends string>(current: "all" | T, value: T, both: [T, T]): "all" | T {
  const on = new Set<T>(current === "all" ? both : [current]);
  if (on.has(value)) on.delete(value);
  else on.add(value);
  return on.size === 1 ? [...on][0] : "all";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-xs font-bold tracking-[.08em] text-muted">{children}</div>;
}

export function DateSidebar({
  filter,
  month,
  today,
  dayCounts,
  onChange,
  onMonth,
}: {
  filter: SheetFilter;
  month: string;
  today: KlDate;
  dayCounts: Record<KlDate, number>;
  onChange: (patch: Partial<SheetFilter>) => void;
  onMonth: (month: string) => void;
}) {
  // First click of a range; the second click completes it.
  const [anchor, setAnchor] = useState<KlDate | null>(null);
  const { from, to } = filter;

  function pickDay(day: KlDate) {
    if (anchor && anchor !== day) {
      onChange(anchor < day ? { from: anchor, to: day } : { from: day, to: anchor });
      setAnchor(null);
    } else {
      onChange({ from: day, to: day });
      setAnchor(day);
    }
  }

  function quick(range: { from: KlDate | null; to: KlDate | null }) {
    setAnchor(null);
    onChange(range);
  }

  const thisMonth = today.slice(0, 7);
  const quickRanges: [string, { from: KlDate | null; to: KlDate | null }][] = [
    ["Today", { from: today, to: today }],
    ["Yesterday", { from: addDays(today, -1), to: addDays(today, -1) }],
    ["7 days", { from: addDays(today, -6), to: today }],
    ["This month", { from: `${thisMonth}-01`, to: today }],
    ["All dates", { from: null, to: null }],
  ];

  const forms: [Form, string, string][] = [
    ["container", "Container", "border-container-mark bg-container-bg text-container"],
    ["lorry", "Lorry", "border-lorry-mark bg-lorry-bg text-lorry"],
  ];

  return (
    <aside data-noprint className="flex w-[290px] flex-none flex-col overflow-y-auto border-l border-line bg-surface px-5 pt-7 pb-5">
      <SectionLabel>DATE</SectionLabel>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => onMonth(addMonths(month, -1))} className="rounded-md p-1.5 text-muted hover:bg-canvas">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[17px] font-bold">{monthLabel(month)}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => onMonth(addMonths(month, 1))}
          className="rounded-md p-1.5 text-muted hover:bg-canvas disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-bold text-muted">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={monthLabel(month)}>
        {monthGrid(month).flatMap((week, w) =>
          week.map((day, i) => {
            if (!day) return <span key={`${w}-${i}`} />;
            const future = day > today;
            const count = dayCounts[day] ?? 0;
            const isEnd = day === from || day === to || day === anchor;
            const inBand = !!from && !!to && day > from && day < to;
            return (
              <button
                key={day}
                type="button"
                disabled={future}
                onClick={() => pickDay(day)}
                aria-pressed={isEnd || inBand}
                aria-label={`${day}${count ? `, ${count} sheet${count === 1 ? "" : "s"}` : ""}`}
                className={cn(
                  "flex h-11 flex-col items-center justify-center text-[15px] leading-none",
                  isEnd ? "rounded-md bg-primary text-white" : inBand ? "bg-primary-soft" : "rounded-md hover:bg-canvas",
                  // Join the band to the ends of the range.
                  isEnd && from !== to && day === from && "rounded-r-none",
                  isEnd && from !== to && day === to && "rounded-l-none",
                  day === today ? "font-extrabold" : "font-semibold",
                  future && "text-placeholder hover:bg-transparent",
                )}
              >
                {Number(day.slice(8))}
                <span className={cn("mt-1 h-2.5 text-[10px] font-bold", isEnd ? "text-white/85" : "text-primary")}>{count || ""}</span>
              </button>
            );
          }),
        )}
      </div>

      <div className="mt-4 flex h-7 items-center justify-between text-[13px] font-medium text-muted">
        <span>Selected: {rangeLabel(from, to)}</span>
        {from || anchor ? (
          <button
            type="button"
            onClick={() => quick({ from: null, to: null })}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-bold text-primary hover:bg-primary-soft"
          >
            <X className="size-3.5" strokeWidth={3} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {quickRanges.map(([label, r]) => {
          const active = r.from === from && r.to === to;
          return (
            <button
              key={label}
              type="button"
              onClick={() => quick(r)}
              aria-pressed={active}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-bold",
                active ? "border-solid bg-solid text-on-solid" : "border-field bg-surface text-ink hover:bg-canvas",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="my-5 border-t border-line" />

      <SectionLabel>FORM</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {forms.map(([value, label, onClass]) => {
          const on = filter.form === "all" || filter.form === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ form: toggleOne<Form>(filter.form, value, ["container", "lorry"]) })}
              className={cn("h-12 rounded-lg border-[1.5px] text-[15px] font-bold", on ? onClass : "border-field bg-surface text-muted hover:bg-canvas")}
            >
              {label}
              {on ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <span className="flex-1" />
      <p className="mt-6 text-xs leading-relaxed font-medium text-muted">
        Click a day, then a second day to select a range. Clear removes the date filter. The small number is how many sheets were submitted that day.
      </p>
    </aside>
  );
}
