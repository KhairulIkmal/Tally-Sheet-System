"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, klDay, rangeLabel } from "@/lib/data/filters";
import { formatDateTime } from "@/lib/tally/dates";
import { formatQty } from "@/lib/tally/draft";
import {
  AUDIT_LIMITS,
  AUDIT_MAX_DAYS,
  FLAG_NAMES,
  KIND_LABEL,
  dailySummary,
  durationText,
  logEntries,
  sheetFlags,
  toCsv,
  type AuditData,
  type AuditKind,
  type FlagKind,
} from "@/lib/tally/audit";
import { FormBadge } from "@/components/worker/ui";
import { FlagChips, KindBadge } from "./audit-bits";

type Tab = "log" | "attention" | "daily";
const PAGE = 300;
const KINDS: AuditKind[] = ["started", "signed", "submitted", "viewed", "printed", "reprinted", "unprinted"];
const FLAG_KINDS = Object.keys(FLAG_NAMES) as FlagKind[];
const TONE_RANK = { danger: 0, warning: 1, info: 2 } as const;

const field =
  "h-10 rounded-lg border border-field bg-surface px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring";

function download(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The office audit log: every step of every sheet in the chosen days (Log),
 * the sheets that need a look (Needs attention) and sheets per day and
 * worker (Daily summary). Each can be exported to CSV.
 */
export function AuditView({
  data,
  from,
  to,
  today,
  since,
  until,
  initialTab,
  initialQuery,
}: {
  data: AuditData;
  from: string;
  to: string;
  today: string;
  since: string;
  until: string;
  initialTab: Tab;
  initialQuery: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState(initialQuery);
  const [worker, setWorker] = useState("");
  const [kind, setKind] = useState<AuditKind | "">("");
  const [flagKind, setFlagKind] = useState<FlagKind | "">("");
  const [shown, setShown] = useState(PAGE);

  const go = (f: string, t: string) => {
    const p = new URLSearchParams({ from: f, to: t });
    if (tab !== "log") p.set("tab", tab);
    if (q.trim()) p.set("q", q.trim());
    startTransition(() => router.push(`/office/audit?${p}`));
  };

  const needle = q.trim().toUpperCase();
  const matches = (...texts: string[]) => !needle || texts.some((t) => t.toUpperCase().includes(needle));

  const entries = useMemo(() => logEntries(data, since, until), [data, since, until]);
  const people = useMemo(
    () => [...new Set([...entries.map((e) => e.actorName), ...data.sheets.map((s) => s.preparedByName)].filter(Boolean))].sort(),
    [entries, data.sheets],
  );
  const log = entries.filter(
    (e) => (!worker || e.actorName === worker) && (!kind || e.kind === kind) && matches(e.ref, e.vehicleNo, e.actorName),
  );

  const flagged = useMemo(
    () =>
      data.sheets
        .map((s) => ({ s, flags: sheetFlags(s, data.events) }))
        .filter((x) => x.flags.length)
        .sort((a, b) => TONE_RANK[a.flags[0].tone] - TONE_RANK[b.flags[0].tone] || b.s.submittedAt.localeCompare(a.s.submittedAt)),
    [data],
  );
  const attention = flagged.filter(
    (x) =>
      (!worker || x.s.preparedByName === worker) &&
      (!flagKind || x.flags.some((f) => f.kind === flagKind)) &&
      matches(x.s.ref, x.s.vehicleNo, x.s.preparedByName),
  );

  const days = useMemo(() => dailySummary(data.sheets, klDay), [data.sheets]);
  const daily = days.filter((d) => (!worker || d.worker === worker) && matches(d.worker));

  const presets: [string, string, string][] = [
    ["Today", today, today],
    ["Last 7 days", addDays(today, -6), today],
    ["Last 30 days", addDays(today, -29), today],
    ["This month", `${today.slice(0, 7)}-01`, today],
  ];

  function exportCsv() {
    const stamp = `${from}_${to}`;
    if (tab === "log")
      download(`tally-audit-log_${stamp}.csv`, [
        ["Time", "Event", "Sheet", "Form", "Container / lorry", "By"],
        ...log.map((e) => [formatDateTime(e.at, { year: true }), KIND_LABEL[e.kind], e.ref, e.form, e.vehicleNo, e.actorName]),
      ]);
    else if (tab === "attention")
      download(`tally-needs-attention_${stamp}.csv`, [
        ["Received", "Sheet", "Form", "Container / lorry", "Worker", "Flags", "Details"],
        ...attention.map(({ s, flags }) => [
          formatDateTime(s.submittedAt, { year: true }),
          s.ref,
          s.form,
          s.vehicleNo,
          s.preparedByName,
          flags.map((f) => f.label).join("; "),
          flags.map((f) => f.detail).join("; "),
        ]),
      ]);
    else
      download(`tally-daily-summary_${stamp}.csv`, [
        ["Day", "Worker", "Sheets", "Pallets", "Qty", "Average loading", "Short pallets", "Checklist issues"],
        ...daily.map((d) => [
          d.day,
          d.worker,
          d.sheets,
          d.pallets,
          formatQty(d.qty),
          d.avgLoadingMs === null ? "" : durationText(d.avgLoadingMs),
          d.shortPallets,
          d.checklistIssues,
        ]),
      ]);
  }

  const tabs: [Tab, string, number | null][] = [
    ["log", "Log", log.length],
    ["attention", "Needs attention", attention.length],
    ["daily", "Daily summary", null],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end gap-4 px-7 pt-6 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-extrabold">Audit log</h1>
          <div className="text-[15px] font-medium text-muted">
            {rangeLabel(from, to)} · {data.sheets.length} sheet{data.sheets.length === 1 ? "" : "s"} received
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value.slice(0, 60));
              setShown(PAGE);
            }}
            placeholder="Sheet no, container / lorry, name"
            aria-label="Search"
            className="h-11 w-[340px] rounded-lg border border-field bg-surface pr-3.5 pl-9 text-[15px] font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-field bg-surface px-4 text-[15px] font-bold hover:bg-canvas"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-7 pb-3.5">
        {presets.map(([label, f, t]) => (
          <button
            key={label}
            type="button"
            onClick={() => go(f, t)}
            className={cn(
              "h-10 rounded-full border px-3.5 text-sm font-bold",
              f === from && t === to ? "border-primary bg-primary-soft text-primary" : "border-field bg-surface hover:bg-canvas",
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-line" />
        <label className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && go(e.target.value, to)}
            className={field}
            aria-label="From"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          To
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => e.target.value && go(from, e.target.value)}
            className={field}
            aria-label="To"
          />
        </label>
        <span className="text-xs font-medium text-faint">Up to {AUDIT_MAX_DAYS} days at a time</span>
        <span className="flex-1" />
        <select value={worker} onChange={(e) => setWorker(e.target.value)} className={field} aria-label="Person">
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {tab === "log" ? (
          <select value={kind} onChange={(e) => setKind(e.target.value as AuditKind | "")} className={field} aria-label="Event">
            <option value="">All events</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        ) : tab === "attention" ? (
          <select value={flagKind} onChange={(e) => setFlagKind(e.target.value as FlagKind | "")} className={field} aria-label="Flag">
            <option value="">All flags</option>
            {FLAG_KINDS.map((k) => (
              <option key={k} value={k}>
                {FLAG_NAMES[k]}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div role="tablist" className="flex gap-1 border-b border-line px-7">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px flex h-11 items-center gap-2 border-b-[3px] px-3 text-[15px] font-bold",
              tab === key ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
            {count !== null ? (
              <span
                className={cn(
                  "rounded-full px-2 text-xs leading-5",
                  key === "attention" && count ? "bg-danger-bg text-danger-ink" : "bg-surface-sunken text-muted",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto px-7 py-4", pending && "opacity-60")}>
        {tab === "log" ? (
          <Table
            cols="170px 190px 1fr 220px"
            head={["TIME", "EVENT", "SHEET", "BY"]}
            empty="Nothing happened in these days, or nothing matches the filters."
            rows={log.slice(0, shown).map((e) => ({
              key: e.key,
              href: `/office/sheets/${e.sheetId}`,
              cells: [
                <span key="t" className="text-body tabular-nums">
                  {formatDateTime(e.at)}
                </span>,
                <KindBadge key="k" kind={e.kind} />,
                <SheetCell key="s" form={e.form} ref_={e.ref} vehicleNo={e.vehicleNo} />,
                <span key="b" className="truncate">
                  {e.actorName || "—"}
                </span>,
              ],
            }))}
            more={log.length > shown ? () => setShown((n) => n + PAGE) : undefined}
          />
        ) : tab === "attention" ? (
          <>
            <p className="mb-3 text-sm font-medium text-muted">
              Checklist answers that mean something was wrong, short pallets, sheets sent more than{" "}
              {durationText(AUDIT_LIMITS.lateMinutes * 60_000)} after signing, reprints, removed print marks, and loading over{" "}
              {durationText(AUDIT_LIMITS.longMinutes * 60_000)} or under {AUDIT_LIMITS.quickMinutes}m. Started and signed times come from
              the worker&apos;s phone.
            </p>
            <Table
              cols="160px 340px 180px 1fr"
              head={["RECEIVED", "SHEET", "WORKER", "WHAT TO CHECK"]}
              empty="Nothing needs a look in these days."
              rows={attention.map(({ s, flags }) => ({
                key: s.id,
                href: `/office/sheets/${s.id}`,
                tall: true,
                cells: [
                  <span key="t" className="text-body tabular-nums">
                    {formatDateTime(s.submittedAt)}
                  </span>,
                  <SheetCell key="s" form={s.form} ref_={s.ref} vehicleNo={s.vehicleNo} />,
                  <span key="w" className="truncate">
                    {s.preparedByName}
                  </span>,
                  <div key="f" className="flex min-w-0 flex-col gap-1 py-2">
                    <FlagChips flags={flags} />
                    {flags
                      .filter((f) => f.kind === "checklist")
                      .map((f) => (
                        <span key={f.kind} className="text-xs font-semibold text-danger-ink">
                          {f.detail}
                        </span>
                      ))}
                  </div>,
                ],
              }))}
            />
          </>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium text-muted">
              By the day each sheet reached the office. Loading is from starting the sheet to signing it, on sheets that have page 2.
            </p>
            <Table
              cols="130px 1fr 90px 90px 190px 140px 120px 140px"
              head={["DAY", "WORKER", "SHEETS", "PALLETS", "QTY", "AVG LOADING", "SHORT PLT", "CHECKLIST ISSUES"]}
              empty="No sheets in these days."
              rows={daily.map((d) => ({
                key: `${d.day}-${d.worker}`,
                cells: [
                  <span key="d" className="font-semibold tabular-nums">
                    {d.day.split("-").reverse().join("/")}
                  </span>,
                  <span key="w" className="truncate">
                    {d.worker}
                  </span>,
                  <span key="s" className="tabular-nums">
                    {d.sheets}
                  </span>,
                  <span key="p" className="tabular-nums">
                    {d.pallets}
                  </span>,
                  <span key="q" className="tabular-nums">
                    {formatQty(d.qty)}
                  </span>,
                  <span key="l" className="tabular-nums">
                    {d.avgLoadingMs === null ? "—" : durationText(d.avgLoadingMs)}
                  </span>,
                  <span key="sp" className={cn("tabular-nums", d.shortPallets && "font-bold text-warning")}>
                    {d.shortPallets}
                  </span>,
                  <span key="c" className={cn("tabular-nums", d.checklistIssues && "font-bold text-danger")}>
                    {d.checklistIssues}
                  </span>,
                ],
              }))}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SheetCell({ form, ref_, vehicleNo }: { form: "container" | "lorry"; ref_: string; vehicleNo: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FormBadge form={form} />
      <span className="truncate font-bold">{vehicleNo || "—"}</span>
      <span className="truncate font-mono text-[13px] text-muted">{ref_}</span>
    </span>
  );
}

function Table({
  cols,
  head,
  rows,
  empty,
  more,
}: {
  cols: string;
  head: string[];
  rows: { key: string; href?: string; tall?: boolean; cells: React.ReactNode[] }[];
  empty: string;
  more?: () => void;
}) {
  const row = "grid items-center gap-3 border-b border-line-soft px-4 text-[15px] font-medium";
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div
        className="grid h-11 items-center gap-3 border-b border-line bg-surface-sunken px-4 text-xs font-bold tracking-[.06em] text-muted"
        style={{ gridTemplateColumns: cols }}
      >
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.length ? (
        rows.map((r) =>
          r.href ? (
            <Link
              key={r.key}
              href={r.href}
              className={cn(row, r.tall ? "min-h-[50px]" : "h-[46px]", "hover:bg-primary-soft")}
              style={{ gridTemplateColumns: cols }}
            >
              {r.cells}
            </Link>
          ) : (
            <div key={r.key} className={cn(row, "h-[46px]")} style={{ gridTemplateColumns: cols }}>
              {r.cells}
            </div>
          ),
        )
      ) : (
        <div className="px-5 py-14 text-center text-[15px] font-medium text-muted">{empty}</div>
      )}
      {more ? (
        <button type="button" onClick={more} className="w-full py-3 text-sm font-bold text-primary hover:bg-canvas">
          Show more
        </button>
      ) : null}
    </div>
  );
}
