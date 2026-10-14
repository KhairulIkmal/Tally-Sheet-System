import { COMPANY_TIMEZONE } from "./constants";

/**
 * Paper dates are DD/MM/YY. Workers type them fast on a number pad, so
 * accept "160427", "16042027", "16-4-27", "16/04/2027" or "16.4.27" and
 * normalise to "16/04/27". Anything that isn't a real calendar date is
 * returned unchanged so the field can flag it.
 */
export function normalizeDate(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";

  let d: string;
  let m: string;
  let y: string;
  const parts = s.split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length === 3) {
    [d, m, y] = parts;
  } else {
    const digits = s.replace(/\D/g, "");
    if (digits.length !== s.length) return s;
    if (digits.length === 6) {
      d = digits.slice(0, 2);
      m = digits.slice(2, 4);
      y = digits.slice(4);
    } else if (digits.length === 8) {
      d = digits.slice(0, 2);
      m = digits.slice(2, 4);
      y = digits.slice(6);
    } else {
      return s;
    }
  }

  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^(\d{2}|\d{4})$/.test(y)) return s;
  const day = Number(d);
  const month = Number(m);
  const year = 2000 + Number(y.slice(-2));
  if (!isRealDate(year, month, day)) return s;

  return `${pad(day)}/${pad(month)}/${y.slice(-2)}`;
}

/** True for a normalised "DD/MM/YY" that is a real calendar date. */
export function isValidPaperDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return false;
  return isRealDate(2000 + Number(match[3]), Number(match[2]), Number(match[1]));
}

/** "16/04/27" → "2027-04-16"; null when empty or invalid. */
export function paperDateToIso(value: string): string | null {
  if (!isValidPaperDate(value)) return null;
  const [d, m, y] = value.split("/");
  return `20${y}-${m}-${d}`;
}

/** "2027-04-16" → "16/04/27"; "" for null. */
export function isoToPaperDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
}

/** Today in Kuala Lumpur as "DD/MM/YY". */
export function todayPaperDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COMPANY_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

/** A timestamp as "14/10/26 15:42" in Kuala Lumpur time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COMPANY_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** The HTML date input's "YYYY-MM-DD" → "DD/MM/YY". */
export function calendarInputToPaperDate(value: string): string {
  return isoToPaperDate(value);
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
