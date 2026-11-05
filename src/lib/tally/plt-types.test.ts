import { describe, expect, it } from "vitest";
import { pltSummary, pltTypeName } from "./constants";
import { autoPltCounts, newDraft, pltCounts, upgradeDraftPlt } from "./draft";
import { draftToPayload, submitPayloadSchema } from "./payload";
import { sampleDraft } from "./sample";
import { paperFromDraft, paperFromSheet, type SheetDetail } from "./sheet";

describe("PLT type names", () => {
  it("writes the full names", () => {
    expect(["L4", "L2", "E", "C", "O"].map(pltTypeName)).toEqual(["L4WAY", "L2WAY", "ECR", "LOSCAM", "OTHERS"]);
  });

  it("still names the old L", () => {
    expect(pltTypeName("L")).toBe("LAM SOON");
  });

  it("summarises the counts with what the others were", () => {
    expect(pltSummary({ L4: 3, L2: 0, O: 1 }, " plastic ")).toBe("L4WAY 3 · OTHERS 1 (PLASTIC)");
    expect(pltSummary({}, "")).toBe("0");
  });
});

describe("a draft saved before the split", () => {
  const old = () => {
    const d = sampleDraft(new Date("2026-10-30T02:00:00Z"), "lorry");
    d.items[0].pallets[0].pltType = "L" as never;
    d.pltAdjust = { L: 1, E: 0, C: 0, O: 0 } as never;
    Reflect.deleteProperty(d, "pltOtherNote");
    return d;
  };

  it("counts its L pallets as L4WAY, and keeps a correction made by hand", () => {
    const d = upgradeDraftPlt(old());
    expect(d.items[0].pallets[0].pltType).toBe("L4");
    expect(d.pltAdjust).toEqual({ L4: 1, L2: 0, E: 0, C: 0, O: 0 });
    expect(d.pltOtherNote).toBe("");
    expect(Object.values(pltCounts(d)).every(Number.isFinite)).toBe(true);
    expect(autoPltCounts(d.items).L4).toBe(4);
  });
});

describe("the Others note", () => {
  it("goes on the payload and the sheet in capitals, on a lorry only", () => {
    const d = sampleDraft(new Date("2026-10-30T02:00:00Z"), "lorry");
    d.pltOtherNote = " plastic ";
    expect(draftToPayload(d, "x").pltOtherNote).toBe("PLASTIC");
    expect(paperFromDraft(d, "A").pltOtherNote).toBe("PLASTIC");
    const c = newDraft("container");
    c.pltOtherNote = "x";
    expect(draftToPayload(c, "x").pltOtherNote).toBe("");
  });
});

describe("a signed sheet waiting on a phone from before the split", () => {
  it("is still accepted, without the new field", () => {
    const d = sampleDraft(new Date("2026-10-30T02:00:00Z"), "lorry");
    d.signature = "data:image/png;base64,AAAA";
    d.signedAt = "2026-10-30T02:00:00.000Z";
    const p = draftToPayload(d, "x") as unknown as Record<string, unknown> & { items: { pallets: { pltType: string }[] }[] };
    p.items[0].pallets[0].pltType = "L";
    delete p.pltOtherNote;
    const parsed = submitPayloadSchema.safeParse(p);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.pltOtherNote).toBe("");
  });
});

describe("the printed sheet", () => {
  const sheet = (pltCountsValue: Record<string, number>, type: string) =>
    ({
      form: "lorry",
      ref: "TS-1",
      date: "2026-10-30",
      header: { contractNo: "", containerNo: "", sealNo: "", siNo: "", disport: "", transferTo: "", doNo: "", lorryNo: "" },
      items: [{ itemNo: 1, name: "X", unit: "CTN", targetQty: null }],
      pallets: [
        { palletNo: 1, itemNo: 1, pltType: type, contractNo: "", remark: "", lines: [{ qty: 1, batch: "", expired: null, prod: null }] },
      ],
      materials: {},
      checks: {},
      pltCounts: pltCountsValue,
      pltOtherNote: "",
      remark: "",
      signature: "",
      signedAt: "2026-10-30T02:00:00Z",
      preparedByName: "A",
      totalPallets: 1,
      qtyByUnit: {},
    }) as unknown as SheetDetail;

  it("writes the full name in the PLT TYPE column and the five boxes", () => {
    const p = paperFromSheet(sheet({ L4: 1, L2: 0, E: 0, C: 0, O: 0 }, "L4"));
    expect(p.rows[0].pltType).toBe("L4WAY");
    expect(p.plt.map((x) => x.label)).toEqual(["L4WAY", "L2WAY", "ECR", "LOSCAM", "OTHERS"]);
  });

  it("keeps an old sheet's Lam Soon pallets in a box of their own", () => {
    const p = paperFromSheet(sheet({ L: 1, E: 0, C: 0, O: 0 }, "L"));
    expect(p.rows[0].pltType).toBe("LAM SOON");
    expect(p.plt[0]).toEqual({ label: "LAM SOON", value: "1" });
  });
});
