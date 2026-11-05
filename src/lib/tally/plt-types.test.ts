import { describe, expect, it } from "vitest";
import { pltCellText, pltSummary, pltTypeName } from "./constants";
import { autoPltCounts, buildPallets, pltCounts, reviewWarnings, upgradeDraftPlt } from "./draft";
import { draftToPayload, submitPayloadSchema } from "./payload";
import { sampleDraft } from "./sample";
import { paperFromSheet, type SheetDetail } from "./sheet";

const at = new Date("2026-10-30T02:00:00Z");

describe("PLT type on the pallet list", () => {
  it("writes the full names", () => {
    expect(["L4", "L2", "E", "C", "O"].map(pltTypeName)).toEqual(["L4WAY", "L2WAY", "ECR", "LOSCAM", "OTHERS"]);
  });

  it("still names the old L", () => {
    expect(pltTypeName("L")).toBe("LAM SOON");
  });
});

describe("TOTAL NUMBER OF PLT", () => {
  it("counts 4-way and 2-way together under L, as the paper form's boxes", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[0].pltType = "L4";
    d.items[0].pallets[1].pltType = "L2";
    expect(pltCounts(d)).toEqual({ L: 5, E: 2, C: 1, O: 1 });
    expect(draftToPayload(d, "x").pltCounts).toEqual({ L: 5, E: 2, C: 1, O: 1 });
  });

  it("summarises by box", () => {
    expect(pltSummary({ L: 3, E: 0, O: 1 })).toBe("L 3 · O 1");
    expect(pltSummary({})).toBe("0");
  });
});

describe("a draft from an earlier version", () => {
  it("opens old L pallets as L4WAY, with real counts", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[0].pltType = "L" as never;
    const up = upgradeDraftPlt(d);
    expect(up.items[0].pallets[0].pltType).toBe("L4");
    expect(autoPltCounts(up.items).L).toBe(5);
  });

  it("puts corrections made while L4 and L2 had boxes under L", () => {
    const d = sampleDraft(at, "lorry");
    d.pltAdjust = { L4: 1, L2: 2, E: 0, C: 0, O: 0 } as never;
    expect(upgradeDraftPlt(d).pltAdjust).toEqual({ L: 3, E: 0, C: 0, O: 0 });
  });

  it("moves the note from under OTHERS to the first Others pallet without a type", () => {
    const d = sampleDraft(at, "lorry");
    d.items[3].pallets[0].pltOther = "";
    const up = upgradeDraftPlt(Object.assign(d, { pltOtherNote: " wood " }));
    expect(up.items[3].pallets[0].pltOther).toBe("WOOD");
    expect("pltOtherNote" in up).toBe(false);
  });
});

describe("an Others pallet", () => {
  it("shows what was written in its PLT TYPE cell, else OTHERS", () => {
    expect(pltCellText("O", " plastic ")).toBe("PLASTIC");
    expect(pltCellText("O", "")).toBe("OTHERS");
    expect(pltCellText("O", null)).toBe("OTHERS");
  });

  it("ignores the writing once the pallet is another type", () => {
    expect(pltCellText("E", "PLASTIC")).toBe("ECR");
    const d = sampleDraft(at, "lorry");
    Object.assign(d.items[0].pallets[0], { pltType: "E", pltOther: "PLASTIC" });
    expect(draftToPayload(d, "x").items[0].pallets[0].pltOther).toBe("");
  });

  it("goes on the payload in capitals", () => {
    const d = sampleDraft(at, "lorry");
    Object.assign(d.items[0].pallets[0], { pltType: "O", pltOther: " wood " });
    expect(draftToPayload(d, "x").items[0].pallets[0].pltOther).toBe("WOOD");
  });

  it("flags on the review when left empty, without stopping the signature", () => {
    const d = sampleDraft(at, "lorry");
    d.items[3].pallets[0].pltOther = "";
    const w = reviewWarnings(d).find((x) => x.message.includes("type of Others pallet empty"));
    expect(w?.severity).toBe("warn");
    d.items[3].pallets[0].pltOther = "WOOD";
    expect(reviewWarnings(d).some((x) => x.message.includes("type of Others pallet"))).toBe(false);
  });

  it("new pallets take the writing only when they are Others", () => {
    expect(buildPallets([1], { pltType: "O", pltOther: "WOOD", contractNo: "" })[0].pltOther).toBe("WOOD");
    expect(buildPallets([1], { pltType: "E", pltOther: "WOOD", contractNo: "" })[0].pltOther).toBe("");
  });
});

describe("a signed sheet waiting on a phone", () => {
  it("is still accepted with the old L and without the Others note", () => {
    const d = sampleDraft(at, "lorry");
    d.signature = "data:image/png;base64,AAAA";
    d.signedAt = "2026-10-30T02:00:00.000Z";
    const p = draftToPayload(d, "x") as unknown as Record<string, unknown> & { items: { pallets: { pltType: string }[] }[] };
    p.items[0].pallets[0].pltType = "L";
    Reflect.deleteProperty(p, "pltOtherNote");
    expect(submitPayloadSchema.safeParse(p).success).toBe(true);
  });
});

describe("the printed sheet", () => {
  const sheet = (pltCountsValue: Record<string, number>, type: string, note = "") =>
    ({
      form: "lorry",
      ref: "TS-1",
      date: "2026-10-30",
      header: { contractNo: "", containerNo: "", sealNo: "", siNo: "", disport: "", transferTo: "", doNo: "", lorryNo: "" },
      items: [{ itemNo: 1, name: "X", unit: "CTN", targetQty: null }],
      pallets: [
        {
          palletNo: 1,
          itemNo: 1,
          pltType: type,
          pltOther: type === "O" ? "PLASTIC" : "",
          contractNo: "",
          remark: "",
          lines: [{ qty: 1, batch: "", expired: null, prod: null }],
        },
      ],
      materials: {},
      checks: {},
      pltCounts: pltCountsValue,
      pltOtherNote: note,
      remark: "",
      signature: "",
      signedAt: "2026-10-30T02:00:00Z",
      preparedByName: "A",
      totalPallets: 1,
      qtyByUnit: {},
    }) as unknown as SheetDetail;

  const boxes = ["L - (LAM SOON)", "E - (ECR)", "C - (LOSCAM)", "O - (OTHERS)"];

  it("has the full name on the row and the paper form's four boxes", () => {
    const p = paperFromSheet(sheet({ L: 1, E: 0, C: 0, O: 0 }, "L2"));
    expect(p.rows[0].pltType).toBe("L2WAY");
    expect(p.plt.map((x) => x.label)).toEqual(boxes);
    expect(p.plt[0].value).toBe("1");
  });

  it("writes an Others pallet's type on its row", () => {
    expect(paperFromSheet(sheet({ L: 0, E: 0, C: 0, O: 1 }, "O")).rows[0].pltType).toBe("PLASTIC");
  });

  it("shows an old sheet the same way", () => {
    const p = paperFromSheet(sheet({ L: 1, E: 0, C: 0, O: 0 }, "L"));
    expect(p.rows[0].pltType).toBe("LAM SOON");
    expect(p.plt.map((x) => x.label)).toEqual(boxes);
  });

  it("adds up a sheet stored with L4 and L2 counted apart, and keeps its note", () => {
    const p = paperFromSheet(sheet({ L: 0, L4: 2, L2: 3, E: 0, C: 0, O: 1 }, "L4", "WOOD"));
    expect(p.plt[0].value).toBe("5");
    expect(p.pltOtherNote).toBe("WOOD");
    expect(pltSummary({ L: 0, L4: 2, L2: 3, O: 1 }, "wood")).toBe("L 5 · O 1 (WOOD)");
  });
});
