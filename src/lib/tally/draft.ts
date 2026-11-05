import {
  CHECKS,
  MATERIALS,
  PLT_GROUPS,
  PLT_OTHER_MAX,
  pltGroup,
  type PltGroup,
  type CheckKey,
  type MaterialKey,
  type PltType,
  type SheetForm,
} from "./constants";
import { isValidPaperDate, todayPaperDate } from "./dates";

/**
 * The sheet a worker is filling in. Lives only on the device (localStorage)
 * until it is signed and submitted. Dates are kept as typed/normalised
 * paper strings ("DD/MM/YY"); quantities as strings so a half-typed field
 * survives a re-render.
 */
export interface DraftLine {
  qty: string;
  batch: string;
  expired: string;
  prod: string;
}

export interface DraftPallet {
  id: string;
  pltType: PltType;
  /** What kind of pallet an Others (O) pallet is. */
  pltOther?: string;
  contractNo: string;
  remark: string;
  lines: DraftLine[];
}

export interface DraftItem {
  id: string;
  name: string;
  /** What QTY counts for this item: CTN, TIN, … */
  unit: string;
  /** The total the order asked for, when known. Drives the short/over check. */
  targetQty: number | null;
  /** Qty on a full pallet, from setup. Saved to the item history. */
  qtyPerPallet: number | null;
  pallets: DraftPallet[];
}

export interface ContainerHeader {
  contractNo: string;
  containerNo: string;
  sealNo: string;
  siNo: string;
  disport: string;
}

export interface LorryHeader {
  transferTo: string;
  doNo: string;
  lorryNo: string;
}

export type DraftHeader = ContainerHeader & LorryHeader & { date: string };

export interface Draft {
  clientId: string;
  form: SheetForm;
  header: DraftHeader;
  items: DraftItem[];
  materials: Record<MaterialKey, number>;
  checks: Record<CheckKey, { qty: number; note: string }>;
  /** Manual corrections on top of the TOTAL NUMBER OF PLT boxes worked out from the pallets. */
  pltAdjust: Record<PltGroup, number>;
  remark: string;
  signature: string | null;
  signedAt: string | null;
  startedAt: string;
  updatedAt: string;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old browsers; uniqueness only matters per device.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function blankLine(): DraftLine {
  return { qty: "", batch: "", expired: "", prod: "" };
}

export function newDraft(form: SheetForm, now: Date = new Date()): Draft {
  const iso = now.toISOString();
  return {
    clientId: newId(),
    form,
    header: {
      contractNo: "",
      containerNo: "",
      sealNo: "",
      siNo: "",
      disport: "",
      transferTo: "",
      doNo: "",
      lorryNo: "",
      date: todayPaperDate(now),
    },
    items: [],
    materials: Object.fromEntries(MATERIALS.map((k) => [k, 0])) as Record<MaterialKey, number>,
    checks: Object.fromEntries(CHECKS.map((k) => [k, { qty: 0, note: "" }])) as Record<
      CheckKey,
      { qty: number; note: string }
    >,
    pltAdjust: { L: 0, E: 0, C: 0, O: 0 },
    remark: "",
    signature: null,
    signedAt: null,
    startedAt: iso,
    updatedAt: iso,
  };
}

/**
 * A draft saved on a phone by an earlier version. Its "L" pallets start as L4WAY, the first
 * choice, and the worker can change them. Corrections made while L4 and L2 had a box each go
 * under L, and a note from the line that was under OTHERS moves to the first Others pallet.
 */
export function upgradeDraftPlt(draft: Draft): Draft {
  const { pltOtherNote: oldNote, ...rest } = draft as Draft & { pltOtherNote?: string };
  const old = (draft.pltAdjust ?? {}) as Partial<Record<PltGroup | "L4" | "L2", number>>;
  let note = (oldNote ?? "").trim().toUpperCase().slice(0, PLT_OTHER_MAX);
  return {
    ...rest,
    pltAdjust: { L: (old.L ?? 0) + (old.L4 ?? 0) + (old.L2 ?? 0), E: old.E ?? 0, C: old.C ?? 0, O: old.O ?? 0 },
    items: draft.items.map((it) => ({
      ...it,
      pallets: it.pallets.map((p) => {
        const next = (p.pltType as string) === "L" ? { ...p, pltType: "L4" as const } : p;
        if (!note || next.pltType !== "O" || next.pltOther?.trim()) return next;
        const pltOther = note;
        note = "";
        return { ...next, pltOther };
      }),
    })),
  };
}

// ── counting ────────────────────────────────────────────────────────────

export function toQty(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function palletQty(pallet: Pick<DraftPallet, "lines">): number {
  return pallet.lines.reduce((sum, l) => sum + toQty(l.qty), 0);
}

export function itemQty(item: Pick<DraftItem, "pallets">): number {
  return item.pallets.reduce((sum, p) => sum + palletQty(p), 0);
}

/** Quantities per unit, e.g. { CTN: 150, TIN: 40 }. Units are never added together. */
export type QtyByUnit = Record<string, number>;

export function totals(items: Pick<DraftItem, "pallets" | "unit">[]): { pallets: number; qty: QtyByUnit } {
  const qty: QtyByUnit = {};
  for (const it of items) qty[it.unit] = (qty[it.unit] ?? 0) + itemQty(it);
  return { pallets: items.reduce((sum, it) => sum + it.pallets.length, 0), qty };
}

/** "150 CTN · 40 TIN", or "0" when nothing is counted. */
export function formatQty(qty: QtyByUnit): string {
  const parts = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([unit, n]) => `${n} ${unit}`);
  return parts.length ? parts.join(" · ") : "0";
}

/** First and last pallet (sticker) number of each item, numbered 1..n across the sheet. */
export function palletRanges(items: Pick<DraftItem, "pallets">[]): { start: number; end: number }[] {
  let n = 0;
  return items.map((it) => {
    const start = n + 1;
    n += it.pallets.length;
    return { start, end: n };
  });
}

export function formatRange(range: { start: number; end: number }): string {
  if (range.end < range.start) return "No pallets";
  return range.end > range.start ? `Pallet ${range.start}–${range.end}` : `Pallet ${range.start}`;
}

export type CountState = "none" | "ok" | "short" | "over";

export interface CountStatus {
  state: CountState;
  counted: number;
  target: number | null;
  /** "150 / 150 CTN ✓", "148 / 150 CTN · short 2", or "148 CTN" with no target. */
  label: string;
  diff: number;
}

export function countStatus(counted: number, target: number | null, unit = "CTN"): CountStatus {
  if (!target) return { state: "none", counted, target: null, label: `${counted} ${unit}`, diff: 0 };
  if (counted === target) return { state: "ok", counted, target, label: `${counted} / ${target} ${unit} ✓`, diff: 0 };
  if (counted < target) {
    return { state: "short", counted, target, label: `${counted} / ${target} ${unit} · short ${target - counted}`, diff: target - counted };
  }
  return { state: "over", counted, target, label: `${counted} / ${target} ${unit} · over ${counted - target}`, diff: counted - target };
}

// ── pallet setup ────────────────────────────────────────────────────────

/**
 * Splits a requested total into full pallets plus a remainder:
 * 150 at 32 per pallet → [32, 32, 32, 32, 22].
 */
export function splitIntoPallets(total: number, perPallet: number, max = 200): number[] {
  if (!(total > 0) || !(perPallet > 0)) return [];
  const full = Math.floor(total / perPallet);
  const rest = total % perPallet;
  const qtys = Array.from({ length: Math.min(full, max) }, () => perPallet);
  if (rest && qtys.length < max) qtys.push(rest);
  return qtys;
}

/**
 * Pallets for a new item from its total. With a qty per pallet the total is
 * split (150 at 32 → 32, 32, 32, 32, 22). Without one, pallets often hold
 * different amounts (80 → 54 + 26), so one pallet is started with the qty
 * left blank and the worker adds pallets and types each qty. `room` is how
 * many pallets the sheet still has space for (a sheet holds MAX_PALLETS).
 */
export function setupPallets(total: number, perPallet: number, room = Infinity): (number | "")[] {
  if (!(total > 0) || room < 1) return [];
  return perPallet > 0 ? splitIntoPallets(total, perPallet, room) : [""];
}

export function buildPallets(
  qtys: (number | "")[],
  defaults: { pltType: PltType; pltOther?: string; contractNo: string },
): DraftPallet[] {
  return qtys.map((q) => ({
    id: newId(),
    pltType: defaults.pltType,
    pltOther: defaults.pltType === "O" ? (defaults.pltOther ?? "") : "",
    contractNo: defaults.contractNo,
    remark: "",
    lines: [{ ...blankLine(), qty: q === "" ? "" : String(q) }],
  }));
}

/** Same PLT type, way included, and for an Others pallet the same type written. */
export function samePltType(a: Pick<DraftPallet, "pltType" | "pltOther">, b: Pick<DraftPallet, "pltType" | "pltOther">): boolean {
  return a.pltType === b.pltType && (a.pltType !== "O" || (a.pltOther ?? "").trim() === (b.pltOther ?? "").trim());
}

/** The pallet just above this one on the sheet (may belong to the previous item). */
export function previousPallet(items: DraftItem[], itemIndex: number, palletIndex: number): DraftPallet | null {
  if (palletIndex > 0) return items[itemIndex].pallets[palletIndex - 1];
  for (let k = itemIndex - 1; k >= 0; k--) {
    const ps = items[k].pallets;
    if (ps.length) return ps[ps.length - 1];
  }
  return null;
}

/**
 * "Same as above" for a whole pallet: copies the lines, PLT type and
 * contract no. When both pallets are single-line, the pallet keeps its own
 * qty (setup already filled it) and only takes batch/expired/prod.
 */
export function copyPalletFrom(target: DraftPallet, source: DraftPallet): DraftPallet {
  const keepQty = target.lines.length === 1 && source.lines.length === 1;
  const lines = source.lines.map((l) => ({ ...l }));
  if (keepQty) lines[0].qty = target.lines[0].qty || source.lines[0].qty;
  return { ...target, pltType: source.pltType, pltOther: source.pltOther ?? "", contractNo: source.contractNo, lines };
}

// ── lorry PLT type totals ───────────────────────────────────────────────

export function autoPltCounts(items: DraftItem[]): Record<PltGroup, number> {
  const counts: Record<PltGroup, number> = { L: 0, E: 0, C: 0, O: 0 };
  for (const it of items) for (const p of it.pallets) counts[pltGroup(p.pltType)] += 1;
  return counts;
}

export function pltCounts(draft: Pick<Draft, "items" | "pltAdjust">): Record<PltGroup, number> {
  const auto = autoPltCounts(draft.items);
  return Object.fromEntries(
    PLT_GROUPS.map((k) => [k, Math.max(0, auto[k] + (draft.pltAdjust[k] ?? 0))]),
  ) as Record<PltGroup, number>;
}

// ── header validation ───────────────────────────────────────────────────

export type HeaderErrors = Partial<Record<keyof DraftHeader, string>>;

export function headerFields(form: SheetForm): (keyof DraftHeader)[] {
  return form === "container"
    ? ["contractNo", "containerNo", "sealNo", "siNo", "disport", "date"]
    : ["transferTo", "doNo", "lorryNo", "date"];
}

/**
 * Header fields are free text and may be left blank (decided 2026-10-22).
 * Only a typed date must be a real date; a blank one is sent as today.
 */
export function validateHeader(_form: SheetForm, header: DraftHeader): HeaderErrors {
  const errors: HeaderErrors = {};
  if (header.date.trim() && !isValidPaperDate(header.date.trim())) {
    errors.date = "Use DD/MM/YY";
  }
  return errors;
}

// ── review warnings ─────────────────────────────────────────────────────

export interface Warning {
  kind: "count" | "missing" | "date" | "plt";
  severity: "warn" | "error";
  message: string;
  /** Item to jump to for fixing it, or null for the materials screen. */
  itemIndex: number | null;
  /** The pallet within that item, when the problem is on one pallet. */
  palletIndex?: number;
  /** The cells to fix on that pallet, so the paper view can mark them. */
  fields?: LineField[];
}

export type LineField = "qty" | "batch" | "expired" | "prod";
const FIELD_OF: Record<string, LineField> = { Qty: "qty", Batch: "batch", Expired: "expired", Prod: "prod" };

/**
 * Everything the review screen flags. "error" blocks submit (an invalid
 * date can't be stored); "warn" lets the worker sign anyway, as on paper.
 */
export function reviewWarnings(draft: Draft): Warning[] {
  const warnings: Warning[] = [];
  const ranges = palletRanges(draft.items);

  draft.items.forEach((it, i) => {
    if (it.pallets.length === 0) {
      warnings.push({ kind: "missing", severity: "error", message: `${it.name}: no pallets`, itemIndex: i });
      return;
    }
    const status = countStatus(itemQty(it), it.targetQty, it.unit);
    if (status.state === "short" || status.state === "over") {
      warnings.push({
        kind: "count",
        severity: "warn",
        message: `${it.name}: ${status.state} ${status.diff} ${it.unit}`,
        itemIndex: i,
      });
    }
    it.pallets.forEach((p, pi) => {
      const no = ranges[i].start + pi;
      const missing = new Set<string>();
      const bad = new Set<string>();
      for (const l of p.lines) {
        if (!toQty(l.qty)) missing.add("Qty");
        if (!l.batch.trim()) missing.add("Batch");
        if (!l.expired.trim()) missing.add("Expired");
        else if (!isValidPaperDate(l.expired.trim())) bad.add("Expired");
        if (!l.prod.trim()) missing.add("Prod");
        else if (!isValidPaperDate(l.prod.trim())) bad.add("Prod");
      }
      if (bad.size) {
        warnings.push({
          kind: "date",
          severity: "error",
          message: `Pallet ${no}: ${[...bad].join(", ")} is not a valid date`,
          itemIndex: i,
          palletIndex: pi,
          fields: [...bad].map((f) => FIELD_OF[f]),
        });
      }
      if (draft.form === "lorry" && p.pltType === "O" && !p.pltOther?.trim()) {
        warnings.push({
          kind: "plt",
          severity: "warn",
          message: `Pallet ${no}: type of Others pallet empty`,
          itemIndex: i,
          palletIndex: pi,
        });
      }
      if (missing.size) {
        warnings.push({
          kind: "missing",
          severity: "warn",
          message: `Pallet ${no}: ${[...missing].join(", ")} empty`,
          itemIndex: i,
          palletIndex: pi,
          fields: [...missing].map((f) => FIELD_OF[f]),
        });
      }
    });
  });

  if (draft.form === "lorry") {
    const total = totals(draft.items).pallets;
    const counted = Object.values(pltCounts(draft)).reduce((a, b) => a + b, 0);
    if (counted !== total) {
      warnings.push({
        kind: "plt",
        severity: "warn",
        message: `Total number of PLT (${counted}) does not match the pallets (${total})`,
        itemIndex: null,
      });
    }
  }

  return warnings;
}

/** The sheet's own number for lists: the container no or the lorry no. */
export function vehicleNo(draft: Pick<Draft, "form" | "header">): string {
  return draft.form === "container" ? draft.header.containerNo : draft.header.lorryNo;
}
