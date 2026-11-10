import {
  CHECKS,
  MATERIALS,
  PLT_GROUPS,
  PLT_LABELS,
  ROWS_PER_PAGE,
  lamSoonWayList,
  normalizeUnit,
  otherPalletList,
  pltCellText,
  storedPltCount,
  type SheetForm,
} from "./constants";
import { formatDateTime, isoToPaperDate } from "./dates";
import { clockTime, cleanChecklist, fullYearDate, effectivePacking, type ChecklistPaper, type Checklist } from "./checklist";
import { draftChecklist, formatQty, itemQty, packingFacts, palletQty, pltCounts, totals, type Draft, type QtyByUnit } from "./draft";

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
  /** What kind of pallet an Others pallet is. */
  pltOther: string;
  /** Marked short by the worker. Null on sheets from before that, which circle each item's last pallet. */
  short?: boolean | null;
  /** The pallet has a photo; photoUrl is a short-lived link to it, null when it couldn't be signed. Never printed. */
  hasPhoto?: boolean;
  photoUrl?: string | null;
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
  /** Page 2, with when loading started and ended. Null on sheets from before it. */
  checklist: (Checklist & { timeStart?: string | null; timeEnd?: string | null }) | null;
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
  /** Item name on the item's first row, then "16 PLT x 40 CTN" when it can be said, then "TOTAL: 640 CTN", blank after (as written on paper). */
  item: string;
  /** "TOTAL: …" under the name when the item has only one row. */
  itemSub?: string;
  /** The item cell holds a red total line, not a name. */
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
  /** The note on the L box: how many of each way. */
  pltWayNote: string;
  /** The note on the OTHERS box: the types of Others pallet on this sheet. */
  pltOtherNote: string;
  /** Page 2, printed after the pallet pages. Null on sheets from before it. */
  checklist?: ChecklistPaper | null;
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
 * "16 PLT x 40 CTN": said only when every pallet holds the same qty, and the
 * item has the rows for it (name, this, TOTAL), so at least 3 pallets.
 */
export function itemPalletsText(unit: string, palletQtys: number[]): string {
  const [first] = palletQtys;
  if (palletQtys.length < 3 || !(first > 0) || palletQtys.some((q) => q !== first)) return "";
  return `${palletQtys.length} PLT x ${first} ${unit || "CTN"}`;
}

/**
 * How an item's rows are written on paper: the name on the first row, then
 * "16 PLT x 40 CTN" when all pallets match, then the TOTAL (under the name for
 * a one-pallet item), and the qty of the item's last pallet circled
 * (48 · 48 · 48 · ⑥; 40 · 40 · ㊵).
 */
export function itemRowMarks(
  name: string,
  unit: string,
  targetQty: number | null,
  palletQtys: number[],
  /** The lorry form says how the pallets split; the container form goes straight to the TOTAL. */
  sayPallets = true,
  /**
   * The pallets the worker marked short: their qty is circled. Left out for a sheet
   * from before that, which circles each item's last pallet as it did then.
   */
  short?: boolean[],
): Pick<PaperRow, "item" | "itemSub" | "itemIsTotal" | "circled">[] {
  const total = itemTotalText(unit, targetQty, palletQtys);
  const pallets = sayPallets ? itemPalletsText(unit, palletQtys) : "";
  const single = palletQtys.length === 1;
  const totalRow = pallets ? 2 : 1;
  const text = (j: number) => (j === 0 ? name : j === totalRow ? total : pallets && j === 1 ? pallets : "");
  return palletQtys.map((q, j) => ({
    item: text(j),
    itemSub: j === 0 && single && total ? total : undefined,
    itemIsTotal: j > 0 && j <= totalRow && !!text(j),
    circled: (short ? !!short[j] : j === palletQtys.length - 1) && q > 0,
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
    checks: CHECKS.map((k) => ({
      label: k,
      value: form === "lorry" && checks[k]?.qty ? String(checks[k].qty) : "",
      note: checks[k]?.note ?? "",
    })),
    plt: PLT_GROUPS.map((k) => ({ label: PLT_LABELS[k], value: form === "lorry" ? String(storedPltCount(plt, k)) : "" })),
  };
}

/** Paper layout data for a submitted sheet. */
export function paperFromSheet(sheet: SheetDetail): PaperData {
  const marks = new Map<number, ReturnType<typeof itemRowMarks>[number]>();
  for (const it of sheet.items) {
    const pallets = sheet.pallets.filter((p) => p.itemNo === it.itemNo);
    const qtys = pallets.map((p) => p.lines.reduce((a, l) => a + (l.qty ?? 0), 0));
    const short = pallets.some((p) => p.short == null) ? undefined : pallets.map((p) => !!p.short);
    itemRowMarks(it.name, it.unit, it.targetQty, qtys, sheet.form === "lorry", short).forEach((m, j) => marks.set(pallets[j].palletNo, m));
  }
  return {
    form: sheet.form,
    ref: sheet.ref,
    header: { ...sheet.header, date: isoToPaperDate(sheet.date) },
    rows: sheet.pallets.map((p) => ({
      no: p.palletNo,
      ...marks.get(p.palletNo),
      item: marks.get(p.palletNo)?.item ?? "",
      pltType: pltCellText(p.pltType, p.pltOther),
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
    // The stored note is only on the few sheets from when the form had a line under OTHERS.
    pltOtherNote: otherPalletList(sheet.pallets) || sheet.pltOtherNote,
    pltWayNote: lamSoonWayList(sheet.pallets),
    remark: sheet.remark,
    signature: sheet.signature || null,
    signedBy: `${sheet.preparedByName.toUpperCase()} · ${formatDateTime(sheet.signedAt)}`,
    checklist: sheet.checklist
      ? (() => {
          const c = cleanChecklist(sheet.checklist);
          const items = sheet.items.map((it) => ({
            name: it.name,
            unit: it.unit,
            qty: sheet.pallets.filter((p) => p.itemNo === it.itemNo).reduce((a, p) => a + p.lines.reduce((b, l) => b + (l.qty ?? 0), 0), 0),
          }));
          return {
            issuedDate: fullYearDate(isoToPaperDate(sheet.date)),
            siNo: sheet.header.siNo,
            contract: sheet.form === "container" ? sheet.header.contractNo : sheet.header.doNo,
            transportAgent: c.transportAgent,
            vehicleNo: sheet.vehicleNo,
            products: checklistProducts(items),
            totalQty: formatQty(sheet.qtyByUnit),
            pList: c.pList,
            liftruckDriver: c.liftruckDriver,
            forkliftDriver: c.forkliftDriver,
            stackerStuffer: c.stackerStuffer,
            timeStart: clockTime(sheet.checklist.timeStart),
            timeEnd: clockTime(sheet.checklist.timeEnd ?? sheet.signedAt),
            container: c.container,
            goods: c.goods,
            packing: c.packing,
            temperature: c.temperature,
            qcBy: c.qcBy,
            department: c.department,
            checkBy: sheet.preparedByName.toUpperCase(),
            signature: sheet.signature || null,
          };
        })()
      : null,
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
    const marks = itemRowMarks(
      up(it.name),
      unit,
      it.targetQty,
      it.pallets.map(palletQty),
      draft.form === "lorry",
      it.pallets.map((p) => !!p.short),
    );
    for (const [j, p] of it.pallets.entries()) {
      n += 1;
      rows.push({
        no: n,
        ...marks[j],
        pltType: draft.form === "lorry" ? pltCellText(p.pltType, p.pltOther) : "",
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
    pltOtherNote: otherPalletList(draft.items.flatMap((it) => it.pallets)),
    pltWayNote: lamSoonWayList(draft.items.flatMap((it) => it.pallets)),
    remark: up(draft.remark),
    signature: draft.signature,
    signedBy: draft.signedAt ? `${signerName.toUpperCase()} · ${formatDateTime(draft.signedAt)}` : "",
    checklist: (() => {
      const c = draftChecklist(draft);
      return {
        issuedDate: fullYearDate(h.date),
        siNo: up(h.siNo),
        contract: draft.form === "container" ? up(h.contractNo) : up(h.doNo),
        transportAgent: up(c.transportAgent),
        vehicleNo: draft.form === "container" ? up(h.containerNo) : up(h.lorryNo),
        products: checklistProducts(draft.items.map((it) => ({ name: up(it.name), unit: normalizeUnit(it.unit), qty: itemQty(it) }))),
        totalQty: formatQty(t.qty),
        pList: up(c.pList),
        liftruckDriver: up(c.liftruckDriver),
        forkliftDriver: up(c.forkliftDriver),
        stackerStuffer: up(c.stackerStuffer),
        timeStart: clockTime(draft.startedAt),
        timeEnd: clockTime(draft.signedAt),
        container: c.container,
        goods: c.goods,
        packing: effectivePacking(c, packingFacts(draft)),
        temperature: c.temperature.trim(),
        qcBy: up(c.qcBy),
        department: up(c.department),
        checkBy: signerName.toUpperCase(),
        signature: draft.signature,
      };
    })(),
    totalPallets: t.pallets,
    qtyByUnit: t.qty,
  };
}

/** Page 2's products: each item with its quantity and packing (its unit). */
function checklistProducts(items: { name: string; unit: string; qty: number }[]) {
  return items.map((it) => ({ name: it.name, quantity: it.qty ? String(it.qty) : "", packing: it.unit }));
}

/** All the printed pages: the pallet pages, then page 2 (the checklist) when there is one. */
export function paperPageCount(data: Pick<PaperData, "rows" | "checklist">): number {
  return pageCount(data.rows.length) + (data.checklist ? 1 : 0);
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
