import { describe, expect, it } from "vitest";
import {
  buildPallets,
  copyPalletFrom,
  countStatus,
  formatQty,
  itemQty,
  newDraft,
  palletRanges,
  pltCounts,
  previousPallet,
  reviewWarnings,
  splitIntoPallets,
  totals,
  validateHeader,
  type Draft,
  type DraftItem, setupPallets } from "./draft";

function item(name: string, qtys: number[], target: number | null = null, unit = "CTN"): DraftItem {
  return {
    id: name,
    name,
    unit,
    targetQty: target,
    qtyPerPallet: null,
    pallets: buildPallets(qtys, { pltType: "L", contractNo: "LS-1" }).map((p) => ({
      ...p,
      lines: p.lines.map((l) => ({ ...l, batch: "B1", expired: "16/04/27", prod: "16/04/25" })),
    })),
  };
}

describe("splitIntoPallets", () => {
  it("fills full pallets and puts the rest on the last one", () => {
    expect(splitIntoPallets(150, 32)).toEqual([32, 32, 32, 32, 22]);
    expect(splitIntoPallets(128, 32)).toEqual([32, 32, 32, 32]);
    expect(splitIntoPallets(10, 32)).toEqual([10]);
  });

  it("returns nothing for missing numbers", () => {
    expect(splitIntoPallets(0, 32)).toEqual([]);
    expect(splitIntoPallets(150, 0)).toEqual([]);
  });

  it("caps the pallet count", () => {
    expect(splitIntoPallets(10000, 1, 200)).toHaveLength(200);
  });
});

describe("numbering and totals", () => {
  const items = [item("A", [32, 32, 32, 32, 22], 150), item("B", [40, 40], 100)];

  it("numbers pallets 1..n across items, like the stickers", () => {
    expect(palletRanges(items)).toEqual([
      { start: 1, end: 5 },
      { start: 6, end: 7 },
    ]);
  });

  it("totals pallets, and quantities per unit", () => {
    expect(totals(items)).toEqual({ pallets: 7, qty: { CTN: 230 } });
    expect(itemQty(items[0])).toBe(150);
  });

  it("never adds different units together", () => {
    const mixed = [item("A", [32, 22]), item("B", [40], null, "TIN"), item("C", [8], null, "CTN")];
    expect(totals(mixed).qty).toEqual({ CTN: 62, TIN: 40 });
    expect(formatQty(totals(mixed).qty)).toBe("62 CTN · 40 TIN");
    expect(formatQty({})).toBe("0");
  });

  it("finds the pallet above, across items", () => {
    expect(previousPallet(items, 1, 0)).toBe(items[0].pallets[4]);
    expect(previousPallet(items, 0, 0)).toBeNull();
  });
});

describe("countStatus", () => {
  it("labels exact, short, over and no target", () => {
    expect(countStatus(150, 150)).toMatchObject({ state: "ok", label: "150 / 150 CTN ✓" });
    expect(countStatus(148, 150)).toMatchObject({ state: "short", label: "148 / 150 CTN · short 2", diff: 2 });
    expect(countStatus(152, 150, "TIN")).toMatchObject({ state: "over", label: "152 / 150 TIN · over 2" });
    expect(countStatus(90, null, "TIN")).toMatchObject({ state: "none", label: "90 TIN" });
  });
});

describe("copyPalletFrom", () => {
  it("keeps the target's own qty for single-line pallets", () => {
    const [a, b] = buildPallets([32, 22], { pltType: "C", contractNo: "X" });
    a.lines[0] = { qty: "32", batch: "B9", expired: "01/01/27", prod: "01/01/26" };
    const copied = copyPalletFrom(b, a);
    expect(copied.lines).toEqual([{ qty: "22", batch: "B9", expired: "01/01/27", prod: "01/01/26" }]);
  });

  it("copies every line of a mixed pallet", () => {
    const [a, b] = buildPallets([12, 0], { pltType: "L", contractNo: "" });
    a.lines = [
      { qty: "12", batch: "A", expired: "", prod: "" },
      { qty: "8", batch: "B", expired: "", prod: "" },
    ];
    expect(copyPalletFrom(b, a).lines.map((l) => l.batch)).toEqual(["A", "B"]);
  });
});

describe("pltCounts", () => {
  it("counts pallet types and applies manual corrections, never below zero", () => {
    const draft = newDraft("lorry");
    draft.items = [item("A", [1, 1, 1])];
    draft.items[0].pallets[2].pltType = "C";
    expect(pltCounts(draft)).toEqual({ L: 2, E: 0, C: 1, O: 0 });
    draft.pltAdjust = { L: -5, E: 1, C: 0, O: 0 };
    expect(pltCounts(draft)).toEqual({ L: 0, E: 1, C: 1, O: 0 });
  });
});

describe("validateHeader", () => {
  it("lets every field be blank, the date too", () => {
    const d = newDraft("lorry");
    d.header.date = "";
    expect(validateHeader("lorry", d.header)).toEqual({});
  });

  it("takes any container number, but only a real date", () => {
    const d = newDraft("container");
    Object.assign(d.header, { containerNo: "TGHU123", date: "31/02/27" });
    expect(validateHeader("container", d.header)).toEqual({ date: "Use DD/MM/YY" });
    d.header.date = "14/10/26";
    expect(validateHeader("container", d.header)).toEqual({});
  });
});

describe("reviewWarnings", () => {
  function draftWith(items: DraftItem[]): Draft {
    const d = newDraft("container");
    d.items = items;
    return d;
  }

  it("is empty for a complete, exact sheet", () => {
    expect(reviewWarnings(draftWith([item("A", [32, 22], 54)]))).toEqual([]);
  });

  it("flags short counts and empty fields as warnings", () => {
    const it1 = item("A", [32, 20], 54);
    it1.pallets[1].lines[0].batch = "";
    const w = reviewWarnings(draftWith([it1]));
    expect(w.map((x) => x.message)).toEqual(["A: short 2 CTN", "Pallet 2: Batch empty"]);
    expect(w.every((x) => x.severity === "warn")).toBe(true);
    // The pallet warning points at the pallet to open from the review.
    expect(w[1]).toMatchObject({ itemIndex: 0, palletIndex: 1 });
    expect(w[0].palletIndex).toBeUndefined();
  });

  it("blocks an invalid date", () => {
    const it1 = item("A", [10]);
    it1.pallets[0].lines[0].expired = "310227";
    const w = reviewWarnings(draftWith([it1]));
    expect(w).toContainEqual(expect.objectContaining({ severity: "error", message: "Pallet 1: Expired is not a valid date" }));
  });

  it("flags a lorry PLT total that doesn't match the pallets", () => {
    const d = newDraft("lorry");
    d.items = [item("A", [10, 10])];
    d.pltAdjust.L = 1;
    expect(reviewWarnings(d).map((x) => x.kind)).toContain("plt");
  });
});

describe("setupPallets", () => {
  it("splits the total when the qty per pallet is known", () => {
    expect(setupPallets(150, 32)).toEqual([32, 32, 32, 32, 22]);
  });
  it("starts one pallet with a blank qty when it is not", () => {
    expect(setupPallets(80, 0)).toEqual([""]);
  });
  it("needs a total", () => {
    expect(setupPallets(0, 32)).toEqual([]);
  });
});
