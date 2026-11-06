import { describe, expect, it } from "vitest";
import { lamSoonWayList, otherPalletList, pltCellText, pltSummary, pltTypeName } from "./constants";
import { autoPltCounts, buildPallets, pltCounts, reviewWarnings, samePltType, upgradeDraftPlt } from "./draft";
import { draftToPayload, submitPayloadSchema } from "./payload";
import { addRow, fillDown, toRows } from "./paper-rows";
import { sampleDraft } from "./sample";
import { itemPalletsText, itemRowMarks, paperFromDraft, paperFromSheet, type SheetDetail } from "./sheet";

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

describe("a new pallet's PLT type", () => {
  it("starts blank, and a lorry sheet can't be signed with one left blank", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[0].pltType = "";
    const w = reviewWarnings(d).find((x) => x.message === "Pallet 1: choose the PLT type");
    expect(w?.severity).toBe("error");
    expect(pltCounts(d).L).toBe(4);
  });

  it("a new row on the paper view starts blank", () => {
    const d = sampleDraft(at, "lorry");
    const rows = toRows(addRow(d.items));
    expect(rows[rows.length - 1].pallet.pltType).toBe("");
  });

  it("same doesn't copy a blank down", () => {
    const d = sampleDraft(at, "lorry");
    toRows(d.items)[0].pallet.pltType = "";
    expect(toRows(fillDown(d.items, 1, 2, { kind: "plt" }))[1].pallet.pltType).not.toBe("");
  });

  it("a container sheet doesn't ask for it", () => {
    const d = sampleDraft(at, "container");
    for (const it of d.items) for (const p of it.pallets) p.pltType = "";
    expect(reviewWarnings(d).some((x) => x.message.includes("PLT type"))).toBe(false);
  });
});

describe("same for the PLT type", () => {
  it("copies the type, the way and what an Others pallet says, down the rows dragged over", () => {
    const d = sampleDraft(at, "lorry");
    const start = toRows(d.items);
    start[0].pallet.pltType = "O";
    start[0].pallet.pltOther = "PLASTIC";
    const rows = toRows(fillDown(d.items, 1, 3, { kind: "plt" }));
    for (const i of [1, 2, 3]) expect(rows[i].pallet).toMatchObject({ pltType: "O", pltOther: "PLASTIC" });
    expect(rows[4].pallet.pltType).not.toBe("O");
  });

  it("copies the way", () => {
    const d = sampleDraft(at, "lorry");
    toRows(d.items)[0].pallet.pltType = "L2";
    expect(toRows(fillDown(d.items, 1, 1, { kind: "plt" }))[1].pallet.pltType).toBe("L2");
  });

  it("keeps each row's own qty, batch and contract", () => {
    const d = sampleDraft(at, "lorry");
    const before = toRows(d.items)[1].pallet;
    const after = toRows(fillDown(d.items, 1, 1, { kind: "plt" }))[1].pallet;
    expect(after.lines).toEqual(before.lines);
    expect(after.contractNo).toBe(before.contractNo);
    expect(after.remark).toBe(before.remark);
  });

  it("counts as the same only with the same way and the same writing", () => {
    expect(samePltType({ pltType: "L4" }, { pltType: "L4", pltOther: "OLD" })).toBe(true);
    expect(samePltType({ pltType: "L4" }, { pltType: "L2" })).toBe(false);
    expect(samePltType({ pltType: "O", pltOther: "A" }, { pltType: "O", pltOther: "B" })).toBe(false);
  });
});

describe("the note on the L box", () => {
  const of = (...types: string[]) => types.map((pltType) => ({ pltType }));

  it("says how many of each way, leaving out a way not used", () => {
    expect(lamSoonWayList(of("L4", "L4", "L2", "E"))).toBe("4W 2 · 2W 1");
    expect(lamSoonWayList(of("L4", "L4"))).toBe("4W 2");
    expect(lamSoonWayList(of("L2"))).toBe("2W 1");
  });

  it("is empty with no way to tell: other types, or an old L", () => {
    expect(lamSoonWayList(of("E", "O"))).toBe("");
    expect(lamSoonWayList(of("L"))).toBe("");
  });

  it("goes on the sheet and in the summary", () => {
    const d = sampleDraft(at, "lorry");
    expect(paperFromDraft(d, "A").pltWayNote).toBe("4W 4 · 2W 1");
    expect(pltSummary({ L: 5, O: 1 }, "WOOD 1", "4W 4 · 2W 1")).toBe("L 5 (4W 4 · 2W 1) · O 1 (WOOD 1)");
  });
});

describe("the pallets line on an item", () => {
  it("is said when every pallet holds the same qty", () => {
    expect(itemPalletsText("CTN", Array(16).fill(40))).toBe("16 PLT x 40 CTN");
    expect(itemPalletsText("TIN", [48, 48, 48])).toBe("3 PLT x 48 TIN");
  });

  it("isn't said for a short pallet, a blank qty, or too few rows", () => {
    expect(itemPalletsText("CTN", [48, 48, 6])).toBe("");
    expect(itemPalletsText("CTN", [0, 0, 0])).toBe("");
    expect(itemPalletsText("CTN", [40, 40])).toBe("");
    expect(itemPalletsText("CTN", [40])).toBe("");
  });

  it("writes name, pallets line, TOTAL, then blanks, with the last pallet circled", () => {
    const m = itemRowMarks("X", "CTN", 160, [40, 40, 40, 40]);
    expect(m.map((r) => r.item)).toEqual(["X", "4 PLT x 40 CTN", "TOTAL: 160 CTN", ""]);
    expect(m.map((r) => !!r.itemIsTotal)).toEqual([false, true, true, false]);
    expect(m.map((r) => !!r.circled)).toEqual([false, false, false, true]);
  });

  it("is left off the container form", () => {
    const rows = paperFromDraft(sampleDraft(at, "container-full"), "A").rows;
    expect(rows[1].item).toBe("TOTAL: 200 CTN");
    expect(rows.some((r) => r.item.includes(" PLT x "))).toBe(false);
  });

  it("stays as name then TOTAL otherwise", () => {
    expect(itemRowMarks("X", "CTN", 150, [48, 48, 48, 6]).map((r) => r.item)).toEqual(["X", "TOTAL: 150 CTN", "", ""]);
    expect(itemRowMarks("X", "CTN", 80, [40, 40]).map((r) => r.item)).toEqual(["X", "TOTAL: 80 CTN"]);
    const one = itemRowMarks("X", "CTN", 40, [40]);
    expect(one[0].item).toBe("X");
    expect(one[0].itemSub).toBe("TOTAL: 40 CTN");
  });
});

describe("the note on the OTHERS box", () => {
  it("lists each type with how many, in the order written", () => {
    const o = (pltOther: string) => ({ pltType: "O", pltOther });
    expect(otherPalletList([o("plastic"), o(" WOOD "), o("PLASTIC")])).toBe("PLASTIC 2 · WOOD 1");
  });

  it("leaves out blanks and other pallet types", () => {
    expect(otherPalletList([{ pltType: "O", pltOther: "" }, { pltType: "E", pltOther: "WOOD" }, { pltType: "O" }])).toBe("");
  });

  it("comes from the pallets on a draft", () => {
    expect(paperFromDraft(sampleDraft(at, "lorry"), "A").pltOtherNote).toBe("PLASTIC 1");
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
    const p = paperFromSheet(sheet({ L: 0, E: 0, C: 0, O: 1 }, "O"));
    expect(p.rows[0].pltType).toBe("PLASTIC");
    expect(p.pltOtherNote).toBe("PLASTIC 1");
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
