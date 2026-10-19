import { describe, expect, it } from "vitest";
import { buildPallets, type DraftItem } from "./draft";
import { addRow, dittoRow, fromRows, removeRow, renameRow, setRowUnit, toRows, unnamedRows, updateRowPallet } from "./paper-rows";

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

  it("renaming the first row of an item renames the rows below it", () => {
    const items = [item("SUN OIL", [32, 32, 32]), item("KNIFE", [10])];
    const out = renameRow(items, 0, "sun cooking oil");
    expect(names(out)).toEqual(["SUN COOKING OIL×3", "KNIFE×1"]);
  });

  it("renaming a middle row splits the item there", () => {
    const out = renameRow([item("A", [1, 2, 3])], 1, "B");
    expect(names(out)).toEqual(["A×1", "B×2"]);
    // The original item keeps its id on the first group.
    expect(out[0].id).toBe("id-A");
    expect(out[0].targetQty).toBe(100);
    expect(out[1].targetQty).toBeNull();
  });

  it("adds a row carrying on the item and PLT type", () => {
    const out = addRow([item("A", [32])]);
    expect(names(out)).toEqual(["A×2"]);
    expect(out[0].pallets[1]).toMatchObject({ pltType: "L", contractNo: "LS-1", lines: [{ qty: "", batch: "" }] });
    expect(names(addRow([]))).toEqual(["×1"]);
    expect(unnamedRows(addRow([]))).toEqual([1]);
  });

  it("removes a row and merges neighbours with the same item", () => {
    const items = [item("A", [1]), item("B", [2]), item("A", [3])];
    expect(names(removeRow(items, 1))).toEqual(["A×2"]);
  });

  it("ditto copies batch and dates from the row above, keeping its own qty", () => {
    let items = [item("A", [32, 22])];
    items = updateRowPallet(items, 0, (p) => ({ ...p, lines: [{ qty: "32", batch: "B1", expired: "16/04/27", prod: "16/04/25" }] }));
    const out = dittoRow(items, 1);
    expect(out[0].pallets[1].lines).toEqual([{ qty: "22", batch: "B1", expired: "16/04/27", prod: "16/04/25" }]);
  });

  it("unit changes the whole item", () => {
    const out = setRowUnit([item("A", [1, 2]), item("B", [3])], 1, "TIN");
    expect(out.map((it) => it.unit)).toEqual(["TIN", "CTN"]);
  });
});
