"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  monthGrid,
  monthLabel,
  rangeLabel,
} from "@/lib/data/filters";
import type { KlDate } from "@/lib/data/types";

type Range = { from: KlDate | null; to: KlDate | null };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
/** The first year with sheets (the system went live in October 2026). */
const FIRST_YEAR = 2026;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-xs font-bold tracking-[.08em] text-muted">
      {children}
    </div>
  );
}

/** Whole days from a to b (both YYYY-MM-DD). */
function daysBetween(a: KlDate, b: KlDate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function DateSidebar({
  filter,
  month,
  today,
  dayCounts,
  onChange,
  onMonth,
  quickRanges: customQuick,
  help,
}: {
  filter: Range;
  month: string;
  today: KlDate;
  dayCounts: Record<KlDate, number>;
  onChange: (range: Range) => void;
  onMonth: (month: string) => void;
  /** Replaces the quick range buttons. */
  quickRanges?: [string, Range][];
  /** Replaces the hint at the bottom. */
  help?: string;
}) {
  // First click of a range; the second click completes it.
  const [anchor, setAnchor] = useState<KlDate | null>(null);
  // While picking the second day: the day under the mouse, to preview the range.
  const [hover, setHover] = useState<KlDate | null>(null);
  // The month and year picker, opened from the month's name, and the year it shows.
  const [picking, setPicking] = useState(false);
  const [pickYear, setPickYear] = useState(Number(month.slice(0, 4)));
  const { from, to } = filter;
  const preview =
    anchor && hover && hover !== anchor
      ? anchor < hover
        ? [anchor, hover]
        : [hover, anchor]
      : null;

  function pickDay(day: KlDate) {
    if (anchor && anchor !== day) {
      onChange(
        anchor < day ? { from: anchor, to: day } : { from: day, to: anchor },
      );
      setAnchor(null);
    } else {
      onChange({ from: day, to: day });
      setAnchor(day);
    }
  }

  function quick(range: Range) {
    setAnchor(null);
    onChange(range);
  }

  const thisMonth = today.slice(0, 7);
  const quickRanges: [string, Range][] = customQuick ?? [
    ["Today", { from: today, to: today }],
    ["Yesterday", { from: addDays(today, -1), to: addDays(today, -1) }],
    ["7 days", { from: addDays(today, -6), to: today }],
    ["This month", { from: `${thisMonth}-01`, to: today }],
    ["All dates", { from: null, to: null }],
  ];

  return (
    <aside
      data-noprint
      className="flex w-[290px] flex-none flex-col overflow-y-auto border-l border-line bg-surface px-5 pt-7 pb-5"
    >
      <SectionLabel>DATE</SectionLabel>
      {picking ? (
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous year"
            disabled={pickYear <= FIRST_YEAR}
            onClick={() => setPickYear((y) => y - 1)}
            className="rounded-md p-1.5 text-muted hover:bg-canvas disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-expanded
            aria-label={`Pick a month in ${pickYear}, or close`}
            onClick={() => setPicking(false)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[17px] font-bold hover:bg-canvas"
          >
            {pickYear}
            <ChevronDown className="size-4 rotate-180 text-muted" />
          </button>
          <button
            type="button"
            aria-label="Next year"
            disabled={pickYear >= Number(thisMonth.slice(0, 4))}
            onClick={() => setPickYear((y) => y + 1)}
            className="rounded-md p-1.5 text-muted hover:bg-canvas disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonth(addMonths(month, -1))}
            className="rounded-md p-1.5 text-muted hover:bg-canvas"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-expanded={false}
            aria-label={`${monthLabel(month)}: jump to another month or year`}
            onClick={() => {
              setPickYear(Number(month.slice(0, 4)));
              setPicking(true);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[17px] font-bold hover:bg-canvas"
          >
            {monthLabel(month)}
            <ChevronDown className="size-4 text-muted" />
          </button>
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
      )}

      {picking ? (
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Months of ${pickYear}`}
        >
          {MONTH_SHORT.map((name, i) => {
            const m = `${pickYear}-${String(i + 1).padStart(2, "0")}`;
            const shown = m === month;
            // The months the picked days fall in.
            const inRange =
              !!from && !!to && m >= from.slice(0, 7) && m <= to.slice(0, 7);
            return (
              <button
                key={m}
                type="button"
                disabled={m > thisMonth}
                aria-current={shown ? "date" : undefined}
                aria-label={monthLabel(m)}
                onClick={() => {
                  setPicking(false);
                  if (!shown) onMonth(m);
                }}
                className={cn(
                  "h-12 rounded-lg text-[15px] font-bold transition-colors",
                  shown
                    ? "bg-primary text-white"
                    : inRange
                      ? "bg-primary-soft text-primary"
                      : "hover:bg-canvas",
                  m === thisMonth && !shown && "ring-1 ring-primary/40",
                  "disabled:bg-transparent disabled:text-placeholder",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 text-center text-xs font-bold text-muted">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="pb-2">
                {d}
              </span>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-y-1"
            role="grid"
            aria-label={monthLabel(month)}
            onMouseLeave={() => setHover(null)}
          >
            {monthGrid(month).flatMap((week, w) =>
              week.map((day, i) => {
                if (!day) return <span key={`${w}-${i}`} />;
                const future = day > today;
                const count = dayCounts[day] ?? 0;
                const isEnd = day === from || day === to || day === anchor;
                const inBand = !!from && !!to && day > from && day < to;
                const inPreview =
                  !!preview &&
                  day >= preview[0] &&
                  day <= preview[1] &&
                  day !== anchor;
                // Each picked tile fills a beat after the one before it, from the start of the range.
                const step =
                  from && (isEnd || inBand) && day !== anchor
                    ? Math.min(31, daysBetween(from, day))
                    : 0;
                const delay = {
                  animationDelay: `${step * 28}ms`,
                  transitionDelay: `${step * 28}ms`,
                };
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={future}
                    onClick={() => pickDay(day)}
                    onMouseEnter={() => anchor && setHover(day)}
                    aria-pressed={isEnd || inBand}
                    aria-label={`${day}${count ? `, ${count} sheet${count === 1 ? "" : "s"}` : ""}`}
                    className={cn(
                      "relative flex h-11 flex-col items-center justify-center text-[15px] leading-none transition-colors duration-200",
                      isEnd
                        ? "text-white"
                        : !inBand && "rounded-md hover:bg-canvas",
                      day === today ? "font-extrabold" : "font-semibold",
                      future && "text-placeholder hover:bg-transparent",
                    )}
                    style={
                      isEnd
                        ? { transitionDelay: delay.transitionDelay }
                        : undefined
                    }
                  >
                    {isEnd || inBand ? (
                      <span
                        // A new range replays the fill.
                        key={`${from}~${to}`}
                        aria-hidden
                        style={delay}
                        className={cn(
                          "animate-tile-in absolute inset-0",
                          isEnd ? "rounded-md bg-primary" : "bg-primary-soft",
                          // Join the band to the ends of the range.
                          isEnd &&
                            from !== to &&
                            day === from &&
                            "rounded-r-none",
                          isEnd &&
                            from !== to &&
                            day === to &&
                            "rounded-l-none",
                          day === anchor && "animate-tile-pulse",
                        )}
                      />
                    ) : null}
                    {inPreview ? (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-md border-2 border-dashed border-primary/45 bg-primary-soft/50"
                      />
                    ) : null}
                    <span className="relative">{Number(day.slice(8))}</span>
                    <span
                      className={cn(
                        "relative mt-1 h-2.5 text-[10px] font-bold",
                        isEnd ? "text-white/85" : "text-primary",
                      )}
                    >
                      {count || ""}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        </>
      )}

      <div className="mt-4 flex h-7 items-center justify-between text-[13px] font-medium text-muted">
        <span>Selected: {rangeLabel(from, to)}</span>
        {(from || anchor) && !customQuick ? (
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
                active
                  ? "border-solid bg-solid text-on-solid"
                  : "border-field bg-surface text-ink hover:bg-canvas",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <span className="flex-1" />
      <p className="mt-6 text-xs leading-relaxed font-medium text-muted">
        {help ??
          "Click a day, then a second day to select a range. Click the month to jump to another month or year. Clear removes the date filter. The small number is how many sheets were submitted that day."}
      </p>
    </aside>
  );
}
