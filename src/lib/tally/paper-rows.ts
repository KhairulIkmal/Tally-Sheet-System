import { normalizeUnit } from "./constants";
import { blankLine, copyPalletFrom, newId, type DraftItem, type DraftPallet } from "./draft";

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

/**
 * Renames row i and the rows right below it that had the same item, so
 * fixing a typo on the first row of an item fixes the whole item.
 */
export function renameRow(items: DraftItem[], i: number, name: string, unit?: string): DraftItem[] {
  const rows = toRows(items);
  const old = key(rows[i].name);
  for (let j = i; j < rows.length && (j === i || key(rows[j].name) === old); j++) {
    rows[j] = { ...rows[j], name: name.toUpperCase(), unit: unit ?? rows[j].unit };
  }
  return fromRows(rows, items);
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

/** A new row at the bottom, carrying on the item, PLT type and contract from the row above. */
export function addRow(items: DraftItem[]): DraftItem[] {
  const rows = toRows(items);
  const above = rows.at(-1);
  rows.push({
    name: above?.name ?? "",
    unit: above?.unit ?? "CTN",
    pallet: {
      id: newId(),
      pltType: above?.pallet.pltType ?? "L",
      contractNo: above?.pallet.contractNo ?? "",
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

/** 〃 ditto: batch / expired / prod (and qty when empty) from the row above. */
export function dittoRow(items: DraftItem[], i: number): DraftItem[] {
  if (i < 1) return items;
  const rows = toRows(items);
  rows[i] = { ...rows[i], pallet: copyPalletFrom(rows[i].pallet, rows[i - 1].pallet) };
  return fromRows(rows, items);
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
