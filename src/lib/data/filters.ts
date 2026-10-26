import { COMPANY_TIMEZONE } from "@/lib/tally/constants";
import type { KlDate, SheetFilter } from "./types";

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const klDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMPANY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Kuala Lumpur calendar day an instant falls on. */
export function klDay(at: Date | string): KlDate {
  return klDayFormat.format(typeof at === "string" ? new Date(at) : at);
}

function isDay(v: string | undefined): v is KlDate {
  return !!v && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
}

export function addDays(day: KlDate, n: number): KlDate {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Midnight in Kuala Lumpur at the start of a day, as an ISO instant. KL is a fixed UTC+8. */
export function dayStart(day: KlDate): string {
  return new Date(`${day}T00:00:00+08:00`).toISOString();
}

/** Today and the six days before it: what the office list opens with. */
export function defaultRange(now: Date = new Date()): { from: KlDate; to: KlDate } {
  const today = klDay(now);
  return { from: addDays(today, -6), to: today };
}

/** Reads the office list filter from search params, ignoring anything unknown. */
export function parseFilter(params: Record<string, string | string[] | undefined>, now: Date = new Date()): SheetFilter {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const form = one("form");
  const status = one("status");
  let from: KlDate | null = null;
  let to: KlDate | null = null;
  if (one("all") !== "1") {
    const f = one("from");
    const t = one("to");
    if (isDay(f)) {
      from = f;
      to = isDay(t) ? t : f;
      if (to < from) [from, to] = [to, from];
    } else {
      ({ from, to } = defaultRange(now));
    }
  }
  return {
    from,
    to,
    form: form === "container" || form === "lorry" ? form : "all",
    status: status === "submitted" || status === "printed" ? status : "all",
    q: (one("q") ?? "").slice(0, 60),
  };
}

/** The search params for a filter, leaving out whatever is the default. */
export function filterParams(filter: SheetFilter, now: Date = new Date()): URLSearchParams {
  const params = new URLSearchParams();
  const def = defaultRange(now);
  if (!filter.from || !filter.to) params.set("all", "1");
  else if (filter.from !== def.from || filter.to !== def.to) {
    params.set("from", filter.from);
    if (filter.to !== filter.from) params.set("to", filter.to);
  }
  if (filter.form !== "all") params.set("form", filter.form);
  if (filter.status !== "all") params.set("status", filter.status);
  if (filter.q.trim()) params.set("q", filter.q.trim());
  return params;
}

/** [since, until) instants for the filter's days, or null for all dates. */
export function rangeBounds(filter: Pick<SheetFilter, "from" | "to">): { since: string; until: string } | null {
  if (!filter.from || !filter.to) return null;
  return { since: dayStart(filter.from), until: dayStart(addDays(filter.to, 1)) };
}

/** "YYYY-MM" from a param, else the month of `fallback`. */
export function parseMonth(v: string | string[] | undefined, fallback: KlDate): string {
  const m = Array.isArray(v) ? v[0] : v;
  if (m && MONTH_RE.test(m)) {
    const month = Number(m.slice(5));
    if (month >= 1 && month <= 12) return m;
  }
  return fallback.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

/** The month as weeks of seven days, Monday first; null pads the first and last week. */
export function monthGrid(month: string): (KlDate | null)[][] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const cells: (KlDate | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  const weeks: (KlDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** How many sheets were submitted on each KL day. */
export function countByDay(submittedAt: string[]): Record<KlDate, number> {
  const out: Record<KlDate, number> = {};
  for (const at of submittedAt) {
    const d = klDay(at);
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(day: KlDate, withMonth: boolean, withYear: boolean): string {
  const d = String(Number(day.slice(8)));
  const m = MONTHS[Number(day.slice(5, 7)) - 1];
  return [d, withMonth ? m : "", withYear ? day.slice(0, 4) : ""].filter(Boolean).join(" ");
}

/** "6 – 11 Oct", "28 Sep – 3 Oct", "14 Oct", or "All dates". The year shows only when it isn't this year. */
export function rangeLabel(from: KlDate | null, to: KlDate | null, now: Date = new Date()): string {
  if (!from || !to) return "All dates";
  const thisYear = klDay(now).slice(0, 4);
  const showYear = from.slice(0, 4) !== thisYear || to.slice(0, 4) !== thisYear;
  if (from === to) return dayLabel(from, true, showYear);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${dayLabel(from, !sameMonth, showYear && !sameYear)} – ${dayLabel(to, true, showYear)}`;
}

export function monthLabel(month: string): string {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

/**
 * Search text safe to embed in a PostgREST `or=(...)` filter: letters,
 * digits, spaces and the separators used in container / D/O numbers.
 */
export function safeSearch(q: string): string {
  return q.replace(/[^A-Za-z0-9 \-/.]/g, "").trim().slice(0, 60);
}
