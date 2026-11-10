/**
 * The office audit log: what happened to each sheet and when, what needs a
 * look, and a daily summary. Pure: built from sheets and their events.
 *
 * Times from the worker's phone (started, signed) are only as right as the
 * phone's clock; "received" is the server's.
 */

import { CONTAINER_CHECKS, GOODS_CHECKS, type Checklist } from "./checklist";
import type { SheetForm } from "./constants";
import type { QtyByUnit } from "./draft";
import type { SheetDetail } from "./sheet";

/** Recorded in tally.sheet_events. */
export type StoredEvent = "submitted" | "printed" | "unprinted" | "viewed" | "reprinted";
/** Read off the sheet itself. */
export type SheetMoment = "started" | "signed";
export type AuditKind = StoredEvent | SheetMoment;

export interface AuditEvent {
  sheetId: string;
  event: StoredEvent;
  at: string;
  actorName: string;
}

export interface AuditSheet {
  id: string;
  ref: string;
  form: SheetForm;
  vehicleNo: string;
  preparedByName: string;
  totalPallets: number;
  qtyByUnit: QtyByUnit;
  /** When the worker started the sheet (phone clock); null on sheets from before page 2. */
  startedAt: string | null;
  /** When the worker signed (phone clock). */
  signedAt: string;
  /** When the server received it. */
  submittedAt: string;
  status: "submitted" | "printed";
  checklist: Checklist | null;
  shortPallets: number;
}

export interface AuditData {
  sheets: AuditSheet[];
  /** Events in the range, and every event of the sheets in it. */
  events: AuditEvent[];
  /** Sheets the events in the range belong to that were submitted outside it: just enough to name them. */
  others: Pick<AuditSheet, "id" | "ref" | "form" | "vehicleNo">[];
}

export const AUDIT_LIMITS = {
  /** Received this long after signing: the phone was offline. */
  lateMinutes: 120,
  /** Loading took longer than this (started → signed). */
  longMinutes: 240,
  /** Or less: the sheet was most likely filled in after the loading. */
  quickMinutes: 5,
};

/** The longest range the audit log loads at once. */
export const AUDIT_MAX_DAYS = 92;

const MIN = 60_000;

/** "1h 12m", "45m", "under 1m", "2d 3h". */
export function durationText(ms: number): string {
  if (!(ms >= MIN)) return "under 1m";
  const m = Math.floor(ms / MIN);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

function ms(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  return Number.isNaN(a) || Number.isNaN(b) ? null : b - a;
}

/** Started → signed, when both are known and in order. */
export function loadingMs(s: Pick<AuditSheet, "startedAt" | "signedAt">): number | null {
  const d = ms(s.startedAt, s.signedAt);
  return d !== null && d >= 0 ? d : null;
}

/** Signed → received. */
export function syncDelayMs(s: Pick<AuditSheet, "signedAt" | "submittedAt">): number | null {
  const d = ms(s.signedAt, s.submittedAt);
  return d !== null && d >= 0 ? d : null;
}

/**
 * Page 2 answers that mean something was wrong. The container checks are all
 * "good" when YES, except UPGRADED CONTAINER, which is just a fact. For the
 * goods, cleanliness and sealing should be YES and the rest NO.
 */
export function checklistConcerns(c: Checklist | null): string[] {
  if (!c) return [];
  const out: string[] = [];
  for (const x of CONTAINER_CHECKS) if (x.key !== "upgraded" && c.container[x.key] === "no") out.push(`Container / lorry ${x.label}: NO`);
  for (const x of GOODS_CHECKS) {
    const good = x.key === "cleanliness" || x.key === "sealing" ? "yes" : "no";
    const v = c.goods[x.key];
    if (v && v !== good) out.push(`Goods ${x.label}: ${v.toUpperCase()}`);
  }
  return out;
}

export type FlagKind = "checklist" | "short" | "late" | "reprinted" | "unprinted" | "long" | "quick";

export interface Flag {
  kind: FlagKind;
  label: string;
  /** Longer text, for a tooltip or the sheet's own page. */
  detail: string;
  tone: "danger" | "warning" | "info";
}

export const FLAG_NAMES: Record<FlagKind, string> = {
  checklist: "Checklist issue",
  short: "Short pallets",
  late: "Sent late",
  reprinted: "Printed again",
  unprinted: "Printed mark removed",
  long: "Long loading",
  quick: "Very quick loading",
};

/** What about a sheet needs a look, most serious first. */
export function sheetFlags(s: AuditSheet, events: AuditEvent[]): Flag[] {
  const flags: Flag[] = [];
  const mine = events.filter((e) => e.sheetId === s.id);
  const concerns = checklistConcerns(s.checklist);
  if (concerns.length)
    flags.push({
      kind: "checklist",
      label: `${concerns.length} checklist issue${concerns.length > 1 ? "s" : ""}`,
      detail: concerns.join(" · "),
      tone: "danger",
    });
  if (s.shortPallets)
    flags.push({
      kind: "short",
      label: `${s.shortPallets} short pallet${s.shortPallets > 1 ? "s" : ""}`,
      detail: "Marked short by the worker (CTN damaged, sample, ...).",
      tone: "warning",
    });
  const delay = syncDelayMs(s);
  if (delay !== null && delay > AUDIT_LIMITS.lateMinutes * MIN)
    flags.push({
      kind: "late",
      label: `Sent ${durationText(delay)} after signing`,
      detail: "The phone was probably offline.",
      tone: "warning",
    });
  const reprints = mine.filter((e) => e.event === "reprinted").length;
  if (reprints)
    flags.push({ kind: "reprinted", label: `Printed again ${reprints}×`, detail: "Print again on a sheet already printed.", tone: "info" });
  const unprints = mine.filter((e) => e.event === "unprinted").length;
  if (unprints)
    flags.push({
      kind: "unprinted",
      label: `Printed mark removed ${unprints}×`,
      detail: "Put back to Submitted after being marked printed.",
      tone: "info",
    });
  const load = loadingMs(s);
  if (load !== null && load > AUDIT_LIMITS.longMinutes * MIN)
    flags.push({ kind: "long", label: `Loading ${durationText(load)}`, detail: "From starting the sheet to signing it.", tone: "info" });
  else if (load !== null && load < AUDIT_LIMITS.quickMinutes * MIN)
    flags.push({
      kind: "quick",
      label: `Loading ${durationText(load)}`,
      detail: "Started and signed within minutes: probably filled in after the loading.",
      tone: "info",
    });
  return flags;
}

export interface TimelineStep {
  kind: AuditKind;
  at: string;
  actorName: string;
  /** The time since the step before, when it says something (loading time, sending delay). */
  gap?: { label: string; warn: boolean };
}

export const KIND_LABEL: Record<AuditKind, string> = {
  started: "Started",
  signed: "Signed",
  submitted: "Received",
  viewed: "Opened",
  printed: "Marked printed",
  reprinted: "Printed again",
  unprinted: "Printed mark removed",
};

/** One sheet's whole story, oldest first. */
export function sheetTimeline(s: AuditSheet, events: AuditEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  if (s.startedAt) steps.push({ kind: "started", at: s.startedAt, actorName: s.preparedByName });
  const load = loadingMs(s);
  steps.push({
    kind: "signed",
    at: s.signedAt,
    actorName: s.preparedByName,
    gap:
      load !== null
        ? { label: `Loading ${durationText(load)}`, warn: load > AUDIT_LIMITS.longMinutes * MIN || load < AUDIT_LIMITS.quickMinutes * MIN }
        : undefined,
  });
  const delay = syncDelayMs(s);
  const late = delay !== null && delay > AUDIT_LIMITS.lateMinutes * MIN;
  const stored = events.filter((e) => e.sheetId === s.id).sort((a, b) => a.at.localeCompare(b.at));
  const received = stored.find((e) => e.event === "submitted");
  steps.push({
    kind: "submitted",
    at: received?.at ?? s.submittedAt,
    actorName: received?.actorName ?? s.preparedByName,
    gap:
      delay !== null && delay >= MIN
        ? { label: late ? `Sent ${durationText(delay)} later (offline?)` : `Sent ${durationText(delay)} later`, warn: late }
        : undefined,
  });
  for (const e of stored) if (e.event !== "submitted") steps.push({ kind: e.event, at: e.at, actorName: e.actorName });
  return steps;
}

export interface LogEntry {
  key: string;
  kind: AuditKind;
  at: string;
  actorName: string;
  sheetId: string;
  ref: string;
  form: SheetForm;
  vehicleNo: string;
}

/** Everything that happened in [since, until), newest first. */
export function logEntries(data: AuditData, since: string, until: string): LogEntry[] {
  const byId = new Map<string, Pick<AuditSheet, "id" | "ref" | "form" | "vehicleNo">>();
  for (const s of [...data.others, ...data.sheets]) byId.set(s.id, s);
  const inRange = (at: string) => at >= since && at < until;
  const out: LogEntry[] = [];
  const add = (kind: AuditKind, at: string, actorName: string, sheetId: string, key: string) => {
    const s = byId.get(sheetId);
    if (!s || !inRange(at)) return;
    out.push({ key, kind, at, actorName, sheetId, ref: s.ref, form: s.form, vehicleNo: s.vehicleNo });
  };
  for (const s of data.sheets) {
    if (s.startedAt) add("started", s.startedAt, s.preparedByName, s.id, `${s.id}:started`);
    add("signed", s.signedAt, s.preparedByName, s.id, `${s.id}:signed`);
  }
  data.events.forEach((e, i) => add(e.event, e.at, e.actorName, e.sheetId, `${e.sheetId}:${e.event}:${e.at}:${i}`));
  // Same instant: the later step of a sheet's story first (received above signed).
  const order: AuditKind[] = ["started", "signed", "submitted", "viewed", "printed", "reprinted", "unprinted"];
  return out.sort((a, b) => b.at.localeCompare(a.at) || order.indexOf(b.kind) - order.indexOf(a.kind));
}

export interface DayRow {
  /** KL day, YYYY-MM-DD. */
  day: string;
  worker: string;
  sheets: number;
  pallets: number;
  qty: QtyByUnit;
  /** Average started → signed, over the sheets that have both. */
  avgLoadingMs: number | null;
  shortPallets: number;
  checklistIssues: number;
}

/** Sheets per KL day (when received) and worker, newest day first, workers A–Z. */
export function dailySummary(sheets: AuditSheet[], klDay: (iso: string) => string): DayRow[] {
  const rows = new Map<string, DayRow & { loads: number[] }>();
  for (const s of sheets) {
    const day = klDay(s.submittedAt);
    const key = `${day}\u0000${s.preparedByName}`;
    let r = rows.get(key);
    if (!r) {
      r = {
        day,
        worker: s.preparedByName,
        sheets: 0,
        pallets: 0,
        qty: {},
        avgLoadingMs: null,
        shortPallets: 0,
        checklistIssues: 0,
        loads: [],
      };
      rows.set(key, r);
    }
    r.sheets += 1;
    r.pallets += s.totalPallets;
    for (const [u, q] of Object.entries(s.qtyByUnit)) r.qty[u] = (r.qty[u] ?? 0) + q;
    const load = loadingMs(s);
    if (load !== null) r.loads.push(load);
    r.shortPallets += s.shortPallets;
    r.checklistIssues += checklistConcerns(s.checklist).length;
  }
  return [...rows.values()]
    .map(({ loads, ...r }) => ({ ...r, avgLoadingMs: loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : null }))
    .sort((a, b) => b.day.localeCompare(a.day) || a.worker.localeCompare(b.worker));
}

/** CSV that Excel opens correctly (BOM, quoted, CRLF). */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    // A leading = + - @ would run as a formula in Excel.
    const safe = typeof v === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** The audit view of a sheet already loaded in full (the office sheet page). */
export function auditOfDetail(s: SheetDetail): { sheet: AuditSheet; events: AuditEvent[] } {
  return {
    sheet: {
      id: s.id,
      ref: s.ref,
      form: s.form,
      vehicleNo: s.vehicleNo,
      preparedByName: s.preparedByName,
      totalPallets: s.totalPallets,
      qtyByUnit: s.qtyByUnit,
      startedAt: s.checklist?.timeStart ?? null,
      signedAt: s.signedAt,
      submittedAt: s.submittedAt,
      status: s.status,
      checklist: s.checklist,
      shortPallets: s.pallets.filter((p) => p.short).length,
    },
    events: s.events.map((e) => ({ sheetId: s.id, event: e.event, at: e.at, actorName: e.actorName })),
  };
}
