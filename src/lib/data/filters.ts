import { COMPANY_TIMEZONE } from "@/lib/tally/constants";
import { DEFAULT_FILTER, type DateRange, type SheetFilter } from "./types";

/** Reads the office list filter from search params, ignoring anything unknown. */
export function parseFilter(params: Record<string, string | string[] | undefined>): SheetFilter {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const range = one("range");
  const form = one("form");
  const status = one("status");
  return {
    range: range === "today" || range === "7" || range === "30" || range === "all" ? range : DEFAULT_FILTER.range,
    form: form === "container" || form === "lorry" ? form : "all",
    status: status === "submitted" || status === "printed" ? status : "all",
    q: (one("q") ?? "").slice(0, 60),
  };
}

/**
 * The earliest submitted_at a range includes, as an ISO instant. "today"
 * means since midnight in Kuala Lumpur, not UTC.
 */
export function rangeStart(range: DateRange, now: Date = new Date()): string | null {
  if (range === "all") return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // KL is a fixed UTC+8 with no daylight saving.
  const midnightKl = new Date(`${parts}T00:00:00+08:00`);
  const days = range === "today" ? 0 : Number(range) - 1;
  return new Date(midnightKl.getTime() - days * 86_400_000).toISOString();
}

/**
 * Search text safe to embed in a PostgREST `or=(...)` filter: letters,
 * digits, spaces and the separators used in container / D/O numbers.
 */
export function safeSearch(q: string): string {
  return q.replace(/[^A-Za-z0-9 \-/.]/g, "").trim().slice(0, 60);
}
