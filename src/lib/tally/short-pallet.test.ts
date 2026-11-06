import { describe, expect, it } from "vitest";
import { draftToPayload } from "./payload";
import { sampleDraft } from "./sample";
import { itemRowMarks, paperFromDraft, paperFromSheet, type SheetDetail } from "./sheet";

const at = new Date("2026-11-06T02:00:00Z");

describe("a short pallet", () => {
  it("is circled where the worker marked it, and nowhere else", () => {
    const marks = itemRowMarks("X", "CTN", null, [48, 46, 48, 6], true, [false, true, false, false]);
    expect(marks.map((m) => !!m.circled)).toEqual([false, true, false, false]);
  });

  it("no longer circles an item's last pallet by itself", () => {
    const d = sampleDraft(at, "lorry");
    expect(paperFromDraft(d, "A").rows.some((r) => r.circled)).toBe(false);
    d.items[0].pallets[3].short = true;
    const rows = paperFromDraft(d, "A").rows;
    expect(rows.filter((r) => r.circled).map((r) => r.no)).toEqual([4]);
  });

  it("isn't circled with no qty to circle", () => {
    expect(itemRowMarks("X", "CTN", null, [48, 0], true, [false, true])[1].circled).toBe(false);
  });

  it("goes on the payload", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[1].short = true;
    expect(draftToPayload(d, "x").items[0].pallets.map((p) => p.short)).toEqual([false, true, false, false]);
  });
});

describe("a sheet sent before short pallets", () => {
  const sheet = (short: (boolean | null)[]) =>
    ({
      form: "lorry",
      ref: "TS-1",
      date: "2026-11-06",
      header: { contractNo: "", containerNo: "", sealNo: "", siNo: "", disport: "", transferTo: "", doNo: "", lorryNo: "" },
      items: [{ itemNo: 1, name: "X", unit: "CTN", targetQty: null }],
      pallets: short.map((s, i) => ({
        palletNo: i + 1,
        itemNo: 1,
        pltType: "L4",
        pltOther: "",
        short: s,
        contractNo: "",
        remark: "",
        lines: [{ qty: 40, batch: "", expired: null, prod: null }],
      })),
      materials: {},
      checks: {},
      pltCounts: {},
      pltOtherNote: "",
      remark: "",
      signature: "",
      signedAt: "2026-11-06T02:00:00Z",
      preparedByName: "A",
      totalPallets: short.length,
      qtyByUnit: {},
    }) as unknown as SheetDetail;

  it("keeps the old marking: each item's last pallet circled", () => {
    expect(paperFromSheet(sheet([null, null, null])).rows.map((r) => !!r.circled)).toEqual([false, false, true]);
  });

  it("a newer one circles only the pallets marked short", () => {
    expect(paperFromSheet(sheet([false, true, false])).rows.map((r) => !!r.circled)).toEqual([false, true, false]);
  });
});
