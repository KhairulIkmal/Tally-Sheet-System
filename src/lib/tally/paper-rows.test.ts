import { describe, expect, it } from "vitest";
import { buildPallets, type DraftItem } from "./draft";
import { addRow, appendItem, dittoField, dittoItem, fromRows, removeRow, renameRow, setRowUnit, toRows, unnamedRows, updateRowPallet } from "./paper-rows";

function item(name: string, qtys: number[], extra: Partial<DraftItem> = {}): DraftItem {
  return {
    id: `id-${name}`,
    name,
    unit: "CTN",
    targetQty: 100,
    qtyPerPallet: 32,
    pallets: buildPallets(qtys, { pltType: "L", contractNo: "LS-1" }),
    ...extra,
  };
}

const names = (items: DraftItem[]) => items.map((it) => `${it.name}×${it.pallets.length}`);

describe("paper rows", () => {
  it("round-trips items through rows, keeping ids and targets", () => {
    const items = [item("SUN COOKING OIL", [32, 32]), item("KNIFE 5KG", [10], { unit: "TIN" })];
    const back = fromRows(toRows(items), items);
    expect(back).toEqual(items);
  });

  it("renaming a row changes only that row", () => {
    const items = [item("SUN OIL", [32, 32, 32]), item("KNIFE", [10])];
    expect(names(renameRow(items, 0, "sun cooking oil"))).toEqual(["SUN COOKING OIL×1", "SUN OIL×2", "KNIFE×1"]);
    const out = renameRow([item("A", [1, 2, 3])], 1, "B");
    expect(names(out)).toEqual(["A×1", "B×1", "A×1"]);
    // The original item keeps its id and target on its first group.
    expect(out[0].id).toBe("id-A");
    expect(out[0].targetQty).toBe(100);
    expect(out[1].targetQty).toBeNull();
  });

  it("adds an empty row, copying nothing", () => {
    const out = addRow([item("A", [32])]);
    expect(names(out)).toEqual(["A×1", "×1"]);
    expect(out[1].pallets[0]).toMatchObject({ pltType: "L", contractNo: "", lines: [{ qty: "", batch: "" }] });
    expect(unnamedRows(out)).toEqual([2]);
  });

  it("〃 on the item copies the name and unit from the row above", () => {
    const out = dittoItem(addRow([item("KNIFE", [10], { unit: "TIN" })]), 1);
    expect(names(out)).toEqual(["KNIFE×2"]);
    expect(out[0].unit).toBe("TIN");
  });

  it("removes a row and merges neighbours with the same item", () => {
    const items = [item("A", [1]), item("B", [2]), item("A", [3])];
    expect(names(removeRow(items, 1))).toEqual(["A×2"]);
  });

  it("〃 copies one field at a time from the row above", () => {
    let items = [item("A", [32, 22])];
    items = updateRowPallet(items, 0, (p) => ({ ...p, lines: [{ qty: "32", batch: "B1", expired: "16/04/27", prod: "16/04/25" }] }));
    const out = dittoField(items, 1, 0, "batch");
    expect(out[0].pallets[1].lines).toEqual([{ qty: "22", batch: "B1", expired: "", prod: "" }]);
    const both = dittoField(out, 1, 0, "prod");
    expect(both[0].pallets[1].lines).toEqual([{ qty: "22", batch: "B1", expired: "", prod: "16/04/25" }]);
    // Nothing above row 1.
    expect(dittoField(items, 0, 0, "batch")).toBe(items);
  });

  it("unit changes the whole item", () => {
    const out = setRowUnit([item("A", [1, 2]), item("B", [3])], 1, "TIN");
    expect(out.map((it) => it.unit)).toEqual(["TIN", "CTN"]);
  });

  it("auto-fill appends the item after the last filled row, reusing empty rows", () => {
    const start = addRow(addRow([item("A", [32])])); // A + 2 empty rows
    const out = appendItem(start, item("B", [32, 32, 22], { targetQty: 86 }));
    expect(names(out)).toEqual(["A×1", "B×3"]);
    expect(out[1]).toMatchObject({ id: "id-B", targetQty: 86 });
    expect(out[1].pallets.map((p) => p.lines[0].qty)).toEqual(["32", "32", "22"]);
  });
});
