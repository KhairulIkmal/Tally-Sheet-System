import { normalizeUnit } from "./constants";
import { blankLine, newId, type DraftItem, type DraftPallet } from "./draft";

/**
 * Paper mode: the sheet as the worker sees it on paper, one row per pallet
 * with the item written on each row. The draft keeps its items → pallets
 * shape; consecutive rows with the same item name are one item.
 */
export interface PaperRow {
  name: string;
  unit: string;
  pallet: DraftPallet;
}

const key = (name: string) => name.trim().toUpperCase();

export function toRows(items: DraftItem[]): PaperRow[] {
  return items.flatMap((it) => it.pallets.map((pallet) => ({ name: it.name, unit: it.unit, pallet })));
}

/**
 * Groups rows back into items. An item keeps its id, target and qty per
 * pallet when a group with the same name is found in `prev` (first unused
 * match, in order), so switching modes back and forth loses nothing.
 */
export function fromRows(rows: PaperRow[], prev: DraftItem[]): DraftItem[] {
  const used = new Set<string>();
  const items: DraftItem[] = [];
  for (const row of rows) {
    const last = items.at(-1);
    if (last && key(last.name) === key(row.name)) {
      last.pallets.push(row.pallet);
      continue;
    }
    const old = prev.find((it) => !used.has(it.id) && key(it.name) === key(row.name));
    if (old) used.add(old.id);
    items.push({
      id: old?.id ?? newId(),
      name: row.name.toUpperCase(),
      unit: normalizeUnit(row.unit),
      targetQty: old?.targetQty ?? null,
      qtyPerPallet: old?.qtyPerPallet ?? null,
      pallets: [row.pallet],
    });
  }
  return items;
}

/** Writes the item on row i only; every row has its own item cell, as on paper. */
export function renameRow(items: DraftItem[], i: number, name: string, unit?: string): DraftItem[] {
  const rows = toRows(items);
  rows[i] = { ...rows[i], name: name.toUpperCase(), unit: unit ?? rows[i].unit };
  return fromRows(rows, items);
}

/** 〃 on the item cell: the item (and its unit) from the row above. */
export function dittoItem(items: DraftItem[], i: number): DraftItem[] {
  if (i < 1) return items;
  const rows = toRows(items);
  return renameRow(items, i, rows[i - 1].name, rows[i - 1].unit);
}

/** The unit belongs to the item: every row of the item at row i changes. */
export function setRowUnit(items: DraftItem[], i: number, unit: string): DraftItem[] {
  let n = 0;
  return items.map((it) => {
    const hit = i >= n && i < n + it.pallets.length;
    n += it.pallets.length;
    return hit ? { ...it, unit } : it;
  });
}

/** A new, empty row at the bottom. Nothing is copied: the worker uses 〃 per cell for that. */
export function addRow(items: DraftItem[]): DraftItem[] {
  const rows = toRows(items);
  rows.push({
    name: "",
    unit: "CTN",
    pallet: {
      id: newId(),
      pltType: "",
      contractNo: "",
      remark: "",
      lines: [blankLine()],
    },
  });
  return fromRows(rows, items);
}

export function removeRow(items: DraftItem[], i: number): DraftItem[] {
  const rows = toRows(items);
  rows.splice(i, 1);
  return fromRows(rows, items);
}

export type DittoField = "qty" | "batch" | "expired" | "prod";

/** The value 〃 would copy into row i, line li: the same line on the row above (its last line if it has fewer). */
export function dittoSource(items: DraftItem[], i: number, li: number, field: DittoField): string {
  if (i < 1) return "";
  const above = toRows(items)[i - 1]?.pallet.lines ?? [];
  return (above[li] ?? above.at(-1))?.[field] ?? "";
}

/** 〃 for one cell: copies just that field (qty, batch, expired or prod) from the row above. */
export function dittoField(items: DraftItem[], i: number, li: number, field: DittoField): DraftItem[] {
  const value = dittoSource(items, i, li, field);
  if (!value) return items;
  return updateRowPallet(items, i, (p) => ({ ...p, lines: p.lines.map((l, j) => (j === li ? { ...l, [field]: value } : l)) }));
}

/** Edits the pallet on row i in place. */
export function updateRowPallet(items: DraftItem[], i: number, fn: (p: DraftPallet) => DraftPallet): DraftItem[] {
  const rows = toRows(items);
  rows[i] = { ...rows[i], pallet: fn(rows[i].pallet) };
  return fromRows(rows, items);
}

/** Pallet numbers (1-based) of rows with no item written. */
export function unnamedRows(items: DraftItem[]): number[] {
  return toRows(items).flatMap((r, i) => (key(r.name) ? [] : [i + 1]));
}

function isEmptyRow(r: PaperRow): boolean {
  return !key(r.name) && !r.pallet.remark && r.pallet.lines.every((l) => !l.qty && !l.batch && !l.expired && !l.prod);
}

/**
 * Auto-fill on the paper: adds an item's generated pallets as rows after
 * the last filled row (empty rows at the bottom are reused). The item keeps
 * its target and qty per pallet, so the count check works as in step by step.
 */
export function appendItem(items: DraftItem[], item: DraftItem): DraftItem[] {
  const rows = toRows(items);
  while (rows.length && isEmptyRow(rows[rows.length - 1])) rows.pop();
  return fromRows([...rows, ...toRows([item])], [...items, item]);
}

/** What a held-and-dragged 〃 fills down: one line field, the item, the contract no or the PLT type. */
export type FillSpec = { kind: "line"; field: DittoField; li: number } | { kind: "item" } | { kind: "contract" } | { kind: "plt" };

/**
 * 〃 held and dragged down, like a spreadsheet's fill handle: rows from..to
 * all take the value on the row above `from`. A row with fewer lines than
 * `li` gets it on its last line.
 */
export function fillDown(items: DraftItem[], from: number, to: number, spec: FillSpec): DraftItem[] {
  const rows = toRows(items);
  if (from < 1 || to < from) return items;
  const source = rows[from - 1];
  const last = Math.min(to, rows.length - 1);
  if (spec.kind === "item") {
    if (!key(source.name)) return items;
    for (let i = from; i <= last; i++) rows[i] = { ...rows[i], name: source.name, unit: source.unit };
    return fromRows(rows, items);
  }
  if (spec.kind === "contract") {
    const value = source.pallet.contractNo;
    if (!value) return items;
    for (let i = from; i <= last; i++) rows[i] = { ...rows[i], pallet: { ...rows[i].pallet, contractNo: value } };
    return fromRows(rows, items);
  }
  if (spec.kind === "plt") {
    const { pltType, pltOther } = source.pallet;
    if (!pltType) return items;
    for (let i = from; i <= last; i++) rows[i] = { ...rows[i], pallet: { ...rows[i].pallet, pltType, pltOther: pltOther ?? "" } };
    return fromRows(rows, items);
  }
  const value = dittoSource(items, from, spec.li, spec.field);
  if (!value) return items;
  for (let i = from; i <= last; i++) {
    const lines = rows[i].pallet.lines;
    const at = Math.min(spec.li, lines.length - 1);
    rows[i] = {
      ...rows[i],
      pallet: { ...rows[i].pallet, lines: lines.map((l, j) => (j === at ? { ...l, [spec.field]: value } : l)) },
    };
  }
  return fromRows(rows, items);
}

/** Rows from..to (either order) taken out; the pallets below move up, as when one row is deleted. */
export function removeRows(items: DraftItem[], from: number, to: number): DraftItem[] {
  const rows = toRows(items);
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(rows.length - 1, Math.max(from, to));
  if (b < a) return items;
  rows.splice(a, b - a + 1);
  return fromRows(rows, items);
}
