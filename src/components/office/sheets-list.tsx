"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/tally/dates";
import type { SheetSummary } from "@/lib/tally/sheet";
import type { SheetFilter } from "@/lib/data/types";
import { FormBadge } from "@/components/worker/ui";

const SEEN_KEY = "tally:office-last-seen";
const COLS = "6px 140px 130px minmax(150px,1fr) minmax(140px,1fr) 80px 100px minmax(170px,1fr) 130px";

export const STATUS_CHIP = {
  submitted: { label: "Submitted", className: "bg-success-bg text-success" },
  printed: { label: "Printed", className: "bg-chip text-body" },
} as const;

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <div className="flex h-[38px] overflow-hidden rounded-lg border border-field bg-surface text-sm font-semibold" role="group" aria-label={label}>
        {options.map(([v, l], i) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn("px-3.5", i > 0 && "border-l border-field", value === v ? "bg-solid text-on-solid" : "text-ink hover:bg-canvas")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SheetsList({ sheets, filter }: { sheets: SheetSummary[]; filter: SheetFilter }) {
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

  function setFilter(patch: Partial<SheetFilter>) {
    const next = { ...filter, q, ...patch };
    const params = new URLSearchParams();
    if (next.range !== "7") params.set("range", next.range);
    if (next.form !== "all") params.set("form", next.form);
    if (next.status !== "all") params.set("status", next.status);
    if (next.q.trim()) params.set("q", next.q.trim());
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
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
  const hasFilter = !!filter.q || filter.range !== "7" || filter.form !== "all" || filter.status !== "all";

  return (
    <>
      <div className="flex items-end gap-4 px-7 pt-6 pb-4">
        <div className="flex-1">
          <h1 className="text-[28px] font-extrabold">Submitted sheets</h1>
          <div className="text-[15px] font-medium text-muted">
            {lastSeen ? `${freshCount} new since you last looked` : "Sheets signed and sent from the warehouse phones"}
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search container, lorry, contract, D/O, worker…"
            aria-label="Search sheets"
            className="h-11 w-[380px] rounded-lg border border-field bg-surface pr-3.5 pl-9 text-[15px] font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-7 pb-3.5">
        <Segmented
          label="Date"
          value={filter.range}
          options={[
            ["today", "Today"],
            ["7", "7 days"],
            ["30", "30 days"],
            ["all", "All"],
          ]}
          onChange={(range) => setFilter({ range })}
        />
        <Segmented
          label="Form"
          value={filter.form}
          options={[
            ["all", "All"],
            ["container", "Container"],
            ["lorry", "Lorry"],
          ]}
          onChange={(form) => setFilter({ form })}
        />
        <Segmented
          label="Status"
          value={filter.status}
          options={[
            ["all", "All"],
            ["submitted", "Submitted"],
            ["printed", "Printed"],
          ]}
          onChange={(status) => setFilter({ status })}
        />
        {hasFilter ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(pathname));
            }}
            className="p-2 text-sm font-bold text-primary"
          >
            Clear filters
          </button>
        ) : null}
        <span className="flex-1" />
        <span className={cn("text-sm font-medium text-muted", pending && "opacity-50")}>
          {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className={cn("mx-7 mb-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-surface", pending && "opacity-70")}>
        <div className="grid h-11 flex-none items-center border-b border-line bg-surface-sunken text-xs font-bold tracking-[.06em] text-muted" style={{ gridTemplateColumns: COLS }}>
          <span />
          <button type="button" onClick={() => setAsc(!asc)} className="pl-3.5 text-left">
            SUBMITTED {asc ? "↑" : "↓"}
          </button>
          <span>FORM</span>
          <span>CONTAINER / LORRY</span>
          <span>CONTRACT / D/O</span>
          <span className="text-right">PALLETS</span>
          <span className="text-right">TOTAL CTN</span>
          <span className="pl-7">PREPARED BY</span>
          <span>STATUS</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                <span className={cn("h-full", fresh ? "bg-primary" : "bg-transparent")} />
                <span className="pl-3.5 text-body">{formatDateTime(s.submittedAt)}</span>
                <span>
                  <FormBadge form={s.form} />
                </span>
                <span className={cn("truncate pr-2", fresh ? "font-bold" : "font-medium")}>{s.vehicleNo}</span>
                <span className="truncate pr-2 text-body">{s.docNo}</span>
                <span className="text-right font-semibold">{s.totalPallets}</span>
                <span className="text-right font-semibold">{s.totalCtn}</span>
                <span className="truncate pl-7">{s.preparedByName}</span>
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
              <div className="text-[15px] font-medium text-muted">Try a different search or filter.</div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
