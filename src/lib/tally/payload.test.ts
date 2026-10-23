import { describe, expect, it } from "vitest";
import { buildPallets, newDraft } from "./draft";
import { draftToPayload, submitPayloadSchema } from "./payload";
import { pageCount, pageRows, paperFromDraft } from "./sheet";

const SIG = "data:image/png;base64,iVBORw0KGgo=";

function lorryDraft() {
  const d = newDraft("lorry", new Date("2026-10-14T03:00:00Z"));
  Object.assign(d.header, { transferTo: "Shah Alam DC", doNo: "do-778120", lorryNo: "wxy 4521" });
  const pallets = buildPallets([40, 0], { pltType: "C", contractNo: "ls-dom-1" });
  pallets[0].lines[0] = { qty: "40", batch: "b1", expired: "20/09/26", prod: "20/09/25" };
  pallets[1].lines = [
    { qty: "12", batch: "b1", expired: "20/09/26", prod: "20/09/25" },
    { qty: "8", batch: "b2", expired: "02/10/26", prod: "" },
  ];
  d.items = [{ id: "i", name: "shortening 16kg", unit: "tin", targetQty: 60, qtyPerPallet: 40, pallets }];
  d.checks.SAMPLE = { qty: 2, note: "for qc" };
  d.signature = SIG;
  d.signedAt = "2026-10-14T07:58:00.000Z";
  return d;
}

describe("draftToPayload", () => {
  it("upper-cases text, converts dates to ISO and passes the schema", () => {
    const p = draftToPayload(lorryDraft(), "test device");
    expect(submitPayloadSchema.safeParse(p).success).toBe(true);
    expect(p.date).toBe("2026-10-14");
    expect(p.header.doNo).toBe("DO-778120");
    expect(p.items[0]).toMatchObject({ name: "SHORTENING 16KG", unit: "TIN", targetQty: 60, qtyPerPallet: 40 });
    expect(p.items[0].pallets[1].lines[1]).toEqual({ qty: 8, batch: "B2", expired: "2026-10-02", prod: null });
    expect(p.pltCounts).toEqual({ L: 0, E: 0, C: 2, O: 0 });
    expect(p.checks.SAMPLE).toEqual({ qty: 2, note: "FOR QC" });
    expect(p.materials).toEqual({});
  });

  it("drops lorry-only fields on a container sheet", () => {
    const d = lorryDraft();
    d.form = "container";
    Object.assign(d.header, { contractNo: "c", containerNo: "TGHU 1234567", sealNo: "s", siNo: "si", disport: "pk" });
    d.materials["LAYER PAD"] = 16;
    const p = draftToPayload(d, "x");
    expect(submitPayloadSchema.safeParse(p).success).toBe(true);
    expect(p.items[0].pallets[0].pltType).toBeNull();
    expect(p.items[0].pallets[0].contractNo).toBe("");
    expect(p.materials["LAYER PAD"]).toBe(16);
    expect(p.pltCounts).toEqual({});
  });

  it("rejects a sheet missing its header or signature", () => {
    const d = lorryDraft();
    d.header.lorryNo = "";
    d.signature = null;
    const result = submitPayloadSchema.safeParse(draftToPayload(d, "x"));
    expect(result.success).toBe(false);
  });
});

describe("pallet limit", () => {
  it("accepts 25 pallets and refuses 26: a sheet is one paper form", () => {
    const d = lorryDraft();
    const full = buildPallets(Array.from({ length: 25 }, () => 4), { pltType: "C", contractNo: "x" });
    full.forEach((p) => (p.lines[0] = { qty: "4", batch: "b", expired: "", prod: "" }));
    d.items = [{ ...d.items[0], targetQty: null, pallets: full }];
    d.pltAdjust = { L: 0, E: 0, C: 0, O: 0 };
    expect(submitPayloadSchema.safeParse(draftToPayload(d, "x")).success).toBe(true);
    d.items[0].pallets = [...full, { ...full[0], id: "extra" }];
    const r = submitPayloadSchema.safeParse(draftToPayload(d, "x"));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("at most 25 pallets");
  });
});

describe("paper layout", () => {
  it("prints a mixed pallet as one row with stacked lines", () => {
    const paper = paperFromDraft(lorryDraft(), "Mohd Hafiz");
    expect(paper.rows).toHaveLength(2);
    expect(paper.rows[1].lines.map((l) => l.batch)).toEqual(["B1", "B2"]);
    // Just the number, even for TIN: the unit is on the TOTAL line.
    expect(paper.rows[1].lines.map((l) => l.qty)).toEqual(["12", "8"]);
    expect(paper.plt.find((x) => x.label.startsWith("C"))?.value).toBe("2");
    expect(paper.signedBy).toBe("MOHD HAFIZ · 14/10/26 15:58");
  });

  it("pads each page to 25 rows and continues numbering on page 2", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
    const rows = Array.from({ length: 27 }, (_, i) => ({ no: i + 1, item: "X", pltType: "", contractNo: "", remark: "", lines: [] }));
    const page2 = pageRows(rows, 2);
    expect(page2).toHaveLength(25);
    expect(page2[0].no).toBe(26);
    expect(page2[2]).toMatchObject({ no: 28, item: "" });
  });
});
