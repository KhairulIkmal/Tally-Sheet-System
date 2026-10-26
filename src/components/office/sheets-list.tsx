"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Container, Search, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/tally/dates";
import type { SheetSummary } from "@/lib/tally/sheet";
import type { KlDate, SheetFilter } from "@/lib/data/types";
import { filterParams, rangeLabel } from "@/lib/data/filters";
import { FormBadge } from "@/components/worker/ui";
import { DateSidebar } from "./date-sidebar";
import { FilterChip } from "./filter-chip";

const SEEN_KEY = "tally:office-last-seen";
const COLS = "6px 124px 128px minmax(120px,1fr) minmax(120px,1fr) 84px 136px minmax(140px,1fr) 160px";

export const STATUS_CHIP = {
  submitted: { label: "Submitted", className: "bg-success-bg text-success" },
  printed: { label: "Printed", className: "bg-chip text-body" },
} as const;

const FORM_LABEL = { all: "Container & Lorry", container: "Container only", lorry: "Lorry only" } as const;

export function SheetsList({
  sheets,
  filter,
  statusCounts,
  formCounts,
  month,
  today,
  dayCounts,
}: {
  sheets: SheetSummary[];
  filter: SheetFilter;
  /** Per status within the picked form, and per form within the picked status. */
  statusCounts: Record<"all" | "submitted" | "printed", number>;
  formCounts: Record<"all" | "container" | "lorry", number>;
  month: string;
  today: KlDate;
  dayCounts: Record<KlDate, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filter.q);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [asc, setAsc] = useState(false);

  // "New" = submitted since this browser last opened the list.
  useEffect(() => {
    let prev: string | null = null;
    try {
      prev = window.localStorage.getItem(SEEN_KEY);
      window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      // Storage blocked: nothing is marked new.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
    setLastSeen(prev);
  }, []);

  // New sheets from the phones appear without a manual reload.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [router]);

  function go(params: URLSearchParams) {
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Changing the dates lets the calendar follow the range; other changes keep the month shown.
  function setFilter(patch: Partial<SheetFilter>) {
    const params = filterParams({ ...filter, q, ...patch });
    if (!("from" in patch) && month !== (filter.to ?? today).slice(0, 7)) params.set("month", month);
    go(params);
  }

  function setMonth(next: string) {
    const params = filterParams({ ...filter, q });
    params.set("month", next);
    go(params);
  }

  // Debounced search.
  useEffect(() => {
    if (q === filter.q) return;
    const t = setTimeout(() => setFilter({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const rows = useMemo(() => (asc ? [...sheets].reverse() : sheets), [sheets, asc]);
  const freshCount = lastSeen ? sheets.filter((s) => s.submittedAt > lastSeen).length : 0;
  const isDefault = filterParams(filter).toString() === "";
  // Dates drop the year when the whole range is in this year.
  const sameYear = !!filter.from && filter.from.slice(0, 4) === today.slice(0, 4);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-end gap-4 px-7 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-extrabold">Submitted sheets</h1>
            <div className="text-[15px] font-medium text-muted">
              {rangeLabel(filter.from, filter.to)} · {FORM_LABEL[filter.form]}
              {freshCount > 0 ? <span className="font-bold text-primary"> · {freshCount} new since you last looked</span> : null}
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search container, lorry, contract, D/O, worker…"
              aria-label="Search sheets"
              className="h-11 w-[340px] rounded-lg border border-field bg-surface pr-3.5 pl-9 text-[15px] font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-7 pb-3.5">
          <FilterChip
            label="Status"
            value={filter.status}
            onChange={(status) => setFilter({ status })}
            options={[
              { value: "all", label: "All", count: statusCounts.all },
              { value: "submitted", label: "Submitted", count: statusCounts.submitted, tone: "text-success" },
              { value: "printed", label: "Printed", count: statusCounts.printed, tone: "text-body" },
            ]}
            activeClass={filter.status === "printed" ? "border-body bg-chip text-body" : "border-success bg-success-bg text-success"}
          />
          <FilterChip
            label="Form"
            value={filter.form}
            onChange={(form) => setFilter({ form })}
            options={[
              { value: "all", label: "All", count: formCounts.all },
              { value: "container", label: "Container", count: formCounts.container, icon: Container, tone: "text-container" },
              { value: "lorry", label: "Lorry", count: formCounts.lorry, icon: Truck, tone: "text-lorry" },
            ]}
            activeClass={filter.form === "lorry" ? "border-lorry bg-lorry-bg text-lorry" : "border-container bg-container-bg text-container"}
          />
          {!isDefault || q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                go(new URLSearchParams());
              }}
              className="p-2 text-[15px] font-bold text-primary"
            >
              Reset
            </button>
          ) : null}
          <span className="flex-1" />
          <span className={cn("text-[15px] font-medium text-muted", pending && "opacity-50")}>
            {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={cn("mx-7 mb-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-surface", pending && "opacity-70")}>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
            <div className="flex min-h-0 min-w-[1040px] flex-1 flex-col">
              <div className="grid h-11 flex-none items-center border-b border-line bg-surface-sunken text-xs font-bold tracking-[.06em] text-muted" style={{ gridTemplateColumns: COLS }}>
                <span />
                <button type="button" onClick={() => setAsc(!asc)} className="pl-3.5 text-left">
                  DATE {asc ? "↑" : "↓"}
                </button>
                <span>FORM</span>
                <span>CONTAINER / LORRY</span>
                <span>CONTRACT / D/O</span>
                <span className="pr-4 text-right">PALLETS</span>
                <span className="text-right">TOTAL QTY</span>
                <span className="pl-6">PREPARED BY</span>
                <span>STATUS</span>
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                {rows.map((s) => {
                  const fresh = !!lastSeen && s.submittedAt > lastSeen;
                  const chip = STATUS_CHIP[s.status];
                  return (
                    <Link
                      key={s.id}
                      href={`/office/sheets/${s.id}`}
                      className={cn("grid h-[50px] items-center border-b border-line-soft text-[15px] font-medium hover:bg-primary-soft", fresh ? "bg-primary-soft/50" : "bg-surface")}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <span className={cn("h-full", fresh ? "bg-primary" : s.status === "printed" ? "bg-field" : "bg-success")} />
                      <span className="pl-3.5 text-body">{formatDateTime(s.submittedAt, { year: !sameYear })}</span>
                      <span>
                        <FormBadge form={s.form} />
                      </span>
                      <span className={cn("truncate pr-2", fresh ? "font-bold" : "font-medium")}>{s.vehicleNo}</span>
                      <span className="truncate pr-2 text-body">{s.docNo}</span>
                      <span className="pr-4 text-right font-semibold tabular-nums">{s.totalPallets}</span>
                      {/* One line per unit (770 CTN / 150 TIN), so nothing is cut off. */}
                      <span className="flex flex-col items-end text-right leading-tight font-semibold tabular-nums">
                        {Object.entries(s.qtyByUnit).length ? (
                          Object.entries(s.qtyByUnit).map(([unit, n]) => (
                            <span key={unit} className={Object.keys(s.qtyByUnit).length > 1 ? "text-[13px]" : undefined}>
                              {n} {unit}
                            </span>
                          ))
                        ) : (
                          <span>0</span>
                        )}
                      </span>
                      <span className="truncate pl-6">{s.preparedByName}</span>
                      <span className="flex items-center gap-2">
                        <span className={cn("flex h-6 items-center rounded-full px-2.5 text-xs font-bold", chip.className)}>{chip.label}</span>
                        {fresh ? <span className="text-[11px] font-bold tracking-[.06em] text-primary">NEW</span> : null}
                      </span>
                    </Link>
                  );
                })}
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-5 py-16 text-center">
                    <div className="text-lg font-bold">No matching sheets</div>
                    <div className="text-[15px] font-medium text-muted">Pick other days on the calendar, or change the search.</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DateSidebar filter={filter} month={month} today={today} dayCounts={dayCounts} onChange={setFilter} onMonth={setMonth} />
    </div>
  );
}
