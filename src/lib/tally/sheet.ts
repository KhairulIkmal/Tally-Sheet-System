import { CHECKS, MATERIALS, OLD_LAM_SOON, PLT_TYPES, ROWS_PER_PAGE, normalizeUnit, pltTypeName, type SheetForm } from "./constants";
import { formatDateTime, isoToPaperDate } from "./dates";
import { palletQty, pltCounts, totals, type Draft, type QtyByUnit } from "./draft";

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
  /** A PltType, or the old "L" on sheets from before the 4-way / 2-way split. */
  pltType: string | null;
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
  pltOtherNote: string;
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
  /** Item name on the item's first row, "TOTAL: 200 CTN" on its second, blank after (as written on paper). */
  item: string;
  /** "TOTAL: …" under the name when the item has only one row. */
  itemSub?: string;
  /** The item cell holds the TOTAL line, not a name. */
  itemIsTotal?: boolean;
  /** The item's last pallet: its qty is circled in red, so the end of each item stands out. */
  circled?: boolean;
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
  /** What the OTHERS pallets were. */
  pltOtherNote: string;
  remark: string;
  signature: string | null;
  signedBy: string;
  totalPallets: number;
  qtyByUnit: QtyByUnit;
}

/** "TOTAL: 200 CTN": the total the order asked for, else what was counted. */
export function itemTotalText(unit: string, targetQty: number | null, palletQtys: number[]): string {
  const total = targetQty ?? palletQtys.reduce((a, b) => a + b, 0);
  return total > 0 ? `TOTAL: ${total} ${unit || "CTN"}` : "";
}

/**
 * How an item's rows are written on paper: the name on the first row, the
 * TOTAL on the second (or under the name for a one-pallet item), and the
 * qty of the item's last pallet circled (48 · 48 · 48 · ⑥; 40 · 40 · ㊵).
 */
export function itemRowMarks(
  name: string,
  unit: string,
  targetQty: number | null,
  palletQtys: number[],
): Pick<PaperRow, "item" | "itemSub" | "itemIsTotal" | "circled">[] {
  const total = itemTotalText(unit, targetQty, palletQtys);
  const single = palletQtys.length === 1;
  return palletQtys.map((q, j) => ({
    item: j === 0 ? name : j === 1 ? total : "",
    itemSub: j === 0 && single && total ? total : undefined,
    itemIsTotal: j === 1 && !!total,
    circled: j === palletQtys.length - 1 && q > 0,
  }));
}

function footer(
  form: SheetForm,
  materials: Record<string, number>,
  checks: Record<string, { qty: number; note: string }>,
  plt: Record<string, number>,
) {
  return {
    materials: MATERIALS.map((k) => ({ label: k, value: form === "container" ? String(materials[k] ?? 0) : "" })),
    checks: CHECKS.map((k) => ({ label: k, value: form === "lorry" && checks[k]?.qty ? String(checks[k].qty) : "", note: checks[k]?.note ?? "" })),
    // The old "L" gets a box of its own only on a sheet that used it.
    plt: (plt[OLD_LAM_SOON] ? [OLD_LAM_SOON, ...PLT_TYPES] : PLT_TYPES).map((k) => ({
      label: pltTypeName(k),
      value: form === "lorry" ? String(plt[k] ?? 0) : "",
    })),
  };
}

/** Paper layout data for a submitted sheet. */
export function paperFromSheet(sheet: SheetDetail): PaperData {
  const marks = new Map<number, ReturnType<typeof itemRowMarks>[number]>();
  for (const it of sheet.items) {
    const pallets = sheet.pallets.filter((p) => p.itemNo === it.itemNo);
    const qtys = pallets.map((p) => p.lines.reduce((a, l) => a + (l.qty ?? 0), 0));
    itemRowMarks(it.name, it.unit, it.targetQty, qtys).forEach((m, j) => marks.set(pallets[j].palletNo, m));
  }
  return {
    form: sheet.form,
    ref: sheet.ref,
    header: { ...sheet.header, date: isoToPaperDate(sheet.date) },
    rows: sheet.pallets.map((p) => ({
      no: p.palletNo,
      ...marks.get(p.palletNo),
      item: marks.get(p.palletNo)?.item ?? "",
      pltType: pltTypeName(p.pltType),
      contractNo: p.contractNo,
      remark: p.remark,
      lines: p.lines.map((l) => ({
        qty: l.qty === null ? "" : String(l.qty),
        expired: isoToPaperDate(l.expired),
        prod: isoToPaperDate(l.prod),
        batch: l.batch,
      })),
    })),
    ...footer(sheet.form, sheet.materials, sheet.checks, sheet.pltCounts),
    pltOtherNote: sheet.pltOtherNote,
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
    const unit = normalizeUnit(it.unit);
    const marks = itemRowMarks(up(it.name), unit, it.targetQty, it.pallets.map(palletQty));
    for (const [j, p] of it.pallets.entries()) {
      n += 1;
      rows.push({
        no: n,
        ...marks[j],
        pltType: draft.form === "lorry" ? pltTypeName(p.pltType) : "",
        contractNo: draft.form === "lorry" ? up(p.contractNo) : "",
        remark: up(p.remark),
        lines: p.lines.map((l) => ({ qty: l.qty.trim(), expired: l.expired.trim(), prod: l.prod.trim(), batch: up(l.batch) })),
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
    pltOtherNote: up(draft.pltOtherNote),
    remark: up(draft.remark),
    signature: draft.signature,
    signedBy: draft.signedAt ? `${signerName.toUpperCase()} · ${formatDateTime(draft.signedAt)}` : "",
    totalPallets: t.pallets,
    qtyByUnit: t.qty,
  };
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
