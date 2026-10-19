import { describe, expect, it } from "vitest";
import { itemRowMarks } from "./sheet";

// The examples from the warehouse's paper sheet.
describe("itemRowMarks", () => {
  it("writes the name on the first row and the TOTAL on the second", () => {
    const rows = itemRowMarks("36X240G DAISY MARG", "CTN", 200, [40, 40, 40, 40, 40]);
    expect(rows.map((r) => r.item)).toEqual(["36X240G DAISY MARG", "TOTAL: 200 CTN", "", "", ""]);
    expect(rows[1].itemIsTotal).toBe(true);
    expect(rows.some((r) => r.loose)).toBe(false);
  });

  it("circles the pallet that is not full", () => {
    expect(itemRowMarks("18KG DAISY MARG-TIN", "TIN", 150, [48, 48, 48, 6]).map((r) => r.loose)).toEqual([false, false, false, true]);
    // No qty per pallet: compared with the fullest pallet.
    expect(itemRowMarks("12X1KG DAISY MARG", "CTN", 80, [54, 26]).map((r) => r.loose)).toEqual([false, true]);
  });

  it("puts the TOTAL under the name for a one-pallet item, never circled", () => {
    const [row] = itemRowMarks("16KG LS SHTG BLUE LB", "CTN", null, [40]);
    expect(row).toMatchObject({ item: "16KG LS SHTG BLUE LB", itemSub: "TOTAL: 40 CTN", loose: false });
  });

  it("uses the counted total when no target was given, and none when nothing is counted", () => {
    expect(itemRowMarks("A", "CTN", null, [10, 5])[1].item).toBe("TOTAL: 15 CTN");
    expect(itemRowMarks("A", "CTN", null, [0, 0])[1]).toMatchObject({ item: "", itemIsTotal: false });
  });
});
