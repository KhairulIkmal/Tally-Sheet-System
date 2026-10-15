import { CHECKS, MATERIALS, PLT_TYPES, ROWS_PER_PAGE, normalizeUnit, type PltType, type SheetForm } from "./constants";
import { formatDateTime, isoToPaperDate } from "./dates";
import { pltCounts, totals, type Draft, type QtyByUnit } from "./draft";

export type SheetStatus = "submitted" | "printed";

/** One row of the sheets list (worker home and office table). */
export interface SheetSummary {
  id: string;
  ref: string;
  form: SheetForm;
  /** Sheet date, ISO "YYYY-MM-DD". */
  date: string;
  /** Container no or lorry no. */
  vehicleNo: string;
  /** Contract no (container) or D/O no (lorry). */
  docNo: string;
  totalPallets: number;
  /** Quantity per unit, e.g. { CTN: 150, TIN: 40 }. */
  qtyByUnit: QtyByUnit;
  preparedBy: string;
  preparedByName: string;
  submittedAt: string;
  status: SheetStatus;
}

export interface SheetLine {
  qty: number | null;
  batch: string;
  /** ISO date or null. */
  expired: string | null;
  prod: string | null;
}

export interface SheetPallet {
  palletNo: number;
  itemNo: number;
  pltType: PltType | null;
  contractNo: string;
  remark: string;
  lines: SheetLine[];
}

export interface SheetItem {
  itemNo: number;
  name: string;
  unit: string;
  targetQty: number | null;
}

export interface SheetEvent {
  event: "submitted" | "printed" | "unprinted";
  at: string;
  actorName: string;
}

export interface SheetDetail extends SheetSummary {
  header: {
    contractNo: string;
    containerNo: string;
    sealNo: string;
    siNo: string;
    disport: string;
    transferTo: string;
    doNo: string;
    lorryNo: string;
  };
  remark: string;
  materials: Record<string, number>;
  checks: Record<string, { qty: number; note: string }>;
  pltCounts: Record<string, number>;
  signature: string;
  signedAt: string;
  device: string;
  printedAt: string | null;
  printedByName: string | null;
  items: SheetItem[];
  pallets: SheetPallet[];
  events: SheetEvent[];
}

// ── paper rendering ─────────────────────────────────────────────────────

export interface PaperLine {
  qty: string;
  expired: string;
  prod: string;
  batch: string;
}

export interface PaperRow {
  no: number;
  item: string;
  pltType: string;
  contractNo: string;
  remark: string;
  lines: PaperLine[];
}

/** Everything the A4 paper layout prints, already formatted as text. */
export interface PaperData {
  form: SheetForm;
  ref: string;
  header: {
    contractNo: string;
    containerNo: string;
    sealNo: string;
    siNo: string;
    disport: string;
    transferTo: string;
    doNo: string;
    lorryNo: string;
    date: string;
  };
  rows: PaperRow[];
  materials: { label: string; value: string }[];
  checks: { label: string; value: string; note: string }[];
  plt: { label: string; value: string }[];
  remark: string;
  signature: string | null;
  signedBy: string;
  totalPallets: number;
  qtyByUnit: QtyByUnit;
}

const PLT_LABELS: Record<PltType, string> = {
  L: "L - (LAM SOON)",
  E: "E - (ECR)",
  C: "C - (LOSCAM)",
  O: "O - (OTHERS)",
};

function footer(
  form: SheetForm,
  materials: Record<string, number>,
  checks: Record<string, { qty: number; note: string }>,
  plt: Record<string, number>,
) {
  return {
    materials: MATERIALS.map((k) => ({ label: k, value: form === "container" ? String(materials[k] ?? 0) : "" })),
    checks: CHECKS.map((k) => ({ label: k, value: form === "lorry" && checks[k]?.qty ? String(checks[k].qty) : "", note: checks[k]?.note ?? "" })),
    plt: PLT_TYPES.map((k) => ({ label: PLT_LABELS[k], value: form === "lorry" ? String(plt[k] ?? 0) : "" })),
  };
}

/** Paper layout data for a submitted sheet. */
export function paperFromSheet(sheet: SheetDetail): PaperData {
  const itemName = new Map(sheet.items.map((it) => [it.itemNo, it.name]));
  const itemUnit = new Map(sheet.items.map((it) => [it.itemNo, it.unit]));
  return {
    form: sheet.form,
    ref: sheet.ref,
    header: { ...sheet.header, date: isoToPaperDate(sheet.date) },
    rows: sheet.pallets.map((p) => ({
      no: p.palletNo,
      item: itemName.get(p.itemNo) ?? "",
      pltType: p.pltType ?? "",
      contractNo: p.contractNo,
      remark: p.remark,
      lines: p.lines.map((l) => ({
        qty: l.qty === null ? "" : paperQty(String(l.qty), itemUnit.get(p.itemNo)),
        expired: isoToPaperDate(l.expired),
        prod: isoToPaperDate(l.prod),
        batch: l.batch,
      })),
    })),
    ...footer(sheet.form, sheet.materials, sheet.checks, sheet.pltCounts),
    remark: sheet.remark,
    signature: sheet.signature || null,
    signedBy: `${sheet.preparedByName.toUpperCase()} · ${formatDateTime(sheet.signedAt)}`,
    totalPallets: sheet.totalPallets,
    qtyByUnit: sheet.qtyByUnit,
  };
}

/** Paper layout data for the worker's on-device preview, before submit. */
export function paperFromDraft(draft: Draft, signerName: string, ref = "NOT SUBMITTED"): PaperData {
  const up = (s: string) => s.trim().toUpperCase();
  const rows: PaperRow[] = [];
  let n = 0;
  for (const it of draft.items) {
    for (const p of it.pallets) {
      n += 1;
      rows.push({
        no: n,
        item: up(it.name),
        pltType: draft.form === "lorry" ? p.pltType : "",
        contractNo: draft.form === "lorry" ? up(p.contractNo) : "",
        remark: up(p.remark),
        lines: p.lines.map((l) => ({ qty: paperQty(l.qty.trim(), normalizeUnit(it.unit)), expired: l.expired.trim(), prod: l.prod.trim(), batch: up(l.batch) })),
      });
    }
  }
  const h = draft.header;
  const t = totals(draft.items);
  return {
    form: draft.form,
    ref,
    header: {
      contractNo: up(h.contractNo),
      containerNo: up(h.containerNo),
      sealNo: up(h.sealNo),
      siNo: up(h.siNo),
      disport: up(h.disport),
      transferTo: up(h.transferTo),
      doNo: up(h.doNo),
      lorryNo: up(h.lorryNo),
      date: h.date,
    },
    rows,
    ...footer(
      draft.form,
      draft.materials,
      Object.fromEntries(CHECKS.map((k) => [k, { qty: draft.checks[k].qty ?? 0, note: up(draft.checks[k].note) }])),
      pltCounts(draft),
    ),
    remark: up(draft.remark),
    signature: draft.signature,
    signedBy: draft.signedAt ? `${signerName.toUpperCase()} · ${formatDateTime(draft.signedAt)}` : "",
    totalPallets: t.pallets,
    qtyByUnit: t.qty,
  };
}

/**
 * The QTY cell: just the number for CTN (the usual case, as on paper),
 * the number and unit for anything else ("40 TIN").
 */
export function paperQty(qty: string, unit: string | undefined): string {
  if (!qty) return "";
  return !unit || unit === "CTN" ? qty : `${qty} ${unit}`;
}

export function pageCount(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE));
}

/** The 25 rows of one printed page; blank rows pad the grid like the paper form. */
export function pageRows(rows: PaperRow[], page: number): PaperRow[] {
  const start = (page - 1) * ROWS_PER_PAGE;
  return Array.from({ length: ROWS_PER_PAGE }, (_, i) => {
    const row = rows[start + i];
    return row ?? { no: start + i + 1, item: "", pltType: "", contractNo: "", remark: "", lines: [] };
  });
}

/** Groups a sheet's pallets back into items for summaries ("Pallet 1–5 · B240915A"). */
export function itemSummaries(sheet: Pick<SheetDetail, "items" | "pallets">) {
  return sheet.items.map((it) => {
    const pallets = sheet.pallets.filter((p) => p.itemNo === it.itemNo);
    const qty = pallets.reduce((s, p) => s + p.lines.reduce((a, l) => a + (l.qty ?? 0), 0), 0);
    const batches = [...new Set(pallets.flatMap((p) => p.lines.map((l) => l.batch).filter(Boolean)))];
    const mixed = pallets
      .filter((p) => p.lines.length > 1)
      .map((p) => `Pallet ${p.palletNo} mixed: ${p.lines.map((l) => `${l.batch || "?"} ${l.qty ?? "?"}`).join(" + ")}`);
    const first = pallets[0]?.palletNo ?? 0;
    const last = pallets[pallets.length - 1]?.palletNo ?? 0;
    return { ...it, qty, batches, mixed, first, last, palletCount: pallets.length };
  });
}
