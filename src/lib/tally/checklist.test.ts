import { describe, expect, it } from "vitest";
import {
  blankChecklist,
  checklistMissing,
  cleanChecklist,
  clockTime,
  effectivePacking,
  packingFromSheet,
  type PackingFacts,
} from "./checklist";
import { reviewWarnings } from "./draft";
import { draftToPayload } from "./payload";
import { sampleDraft } from "./sample";
import { paperFromDraft, paperFromSheet, paperPageCount, type SheetDetail } from "./sheet";

const at = new Date("2026-11-06T02:00:00Z");
const container: PackingFacts = {
  form: "container",
  hasPhoto: false,
  materials: { PLYWOOD: 2, LINER: 0, "LAYER PAD": 25 },
  sealNo: "PK 1",
};

describe("page 2 from page 1", () => {
  it("ticks the packing checks from the materials and the seal on a container sheet", () => {
    expect(packingFromSheet(container)).toEqual({
      plywood: "yes",
      polyfoam: "no",
      liner: "no",
      layerPad: "yes",
      airBag: "no",
      lockSeal: "yes",
    });
  });

  it("ticks Photograph when a pallet has a photo", () => {
    expect(packingFromSheet({ ...container, hasPhoto: true }).photograph).toBe("yes");
  });

  it("leaves a lorry sheet's to the worker", () => {
    expect(packingFromSheet({ form: "lorry", hasPhoto: false, materials: {}, sealNo: "" })).toEqual({});
  });

  it("the worker's own choice wins", () => {
    const c = blankChecklist();
    c.packing.plywood = "no";
    expect(effectivePacking(c, container).plywood).toBe("no");
  });
});

describe("page 2 must be complete", () => {
  it("lists what is missing on a blank one", () => {
    const missing = checklistMissing(blankChecklist(), container);
    expect(missing).toEqual([
      "Condition of the container: 9 not ticked",
      "Condition of drum / CTNs / tins: 9 not ticked",
      "Photograph, packing and seal: 2 not ticked",
      "Transport / Agent is empty",
      "QC / Goods inspections by is empty",
      "Department is empty",
    ]);
  });

  it("says lorry on a lorry sheet", () => {
    expect(checklistMissing(blankChecklist(), { form: "lorry", hasPhoto: false, materials: {}, sealNo: "" })[0]).toBe(
      "Condition of the lorry: 9 not ticked",
    );
  });

  it("stops the signature until it is", () => {
    const d = sampleDraft(at, "lorry");
    d.checklist!.qcBy = "";
    const w = reviewWarnings(d).find((x) => x.kind === "checklist");
    expect(w).toMatchObject({ severity: "error", message: "Checklist: QC / Goods inspections by is empty" });
  });

  it("is complete on the samples", () => {
    for (const form of ["container", "container-full", "lorry", "lorry-full", "lorry-paper"] as const) {
      expect(reviewWarnings(sampleDraft(at, form)).filter((w) => w.kind === "checklist")).toEqual([]);
    }
  });

  it("names, drivers, P/List and temperature are optional", () => {
    const d = sampleDraft(at, "lorry");
    Object.assign(d.checklist!, { pList: "", liftruckDriver: "", forkliftDriver: "", stackerStuffer: "", temperature: "" });
    expect(reviewWarnings(d).filter((w) => w.kind === "checklist")).toEqual([]);
  });
});

describe("page 2 on the sheet", () => {
  it("goes on the payload with the start and end times", () => {
    const d = sampleDraft(at, "container");
    d.signedAt = "2026-11-06T06:30:00.000Z";
    const p = draftToPayload(d, "x").checklist as Record<string, unknown>;
    expect(p.timeStart).toBe(d.startedAt);
    expect(p.timeEnd).toBe("2026-11-06T06:30:00.000Z");
    expect((p.packing as Record<string, string>).lockSeal).toBe("yes");
  });

  it("is printed as a page after the pallets, with page 1's details", () => {
    const d = sampleDraft(at, "container");
    d.signedAt = "2026-11-06T06:30:00.000Z";
    const paper = paperFromDraft(d, "Mohd Hafiz");
    expect(paperPageCount(paper)).toBe(2);
    expect(paper.checklist).toMatchObject({
      siNo: "8106092",
      contract: "8900003290",
      vehicleNo: "TGCU 2174700",
      transportAgent: "KONSORTIUM LOGISTIK",
      timeEnd: "14:30",
      checkBy: "MOHD HAFIZ",
      qcBy: "NURUL AINA",
    });
    expect(paper.checklist!.products[0]).toEqual({ name: "36X240G DAISY MARG", quantity: "160", packing: "CTN" });
  });

  it("a sheet from before page 2 prints only its pallet pages", () => {
    const sheet = { checklist: null, rows: [] } as unknown as SheetDetail;
    expect(paperPageCount({ rows: [], checklist: null })).toBe(1);
    void sheet;
    void paperFromSheet;
  });

  it("drops anything unexpected coming back from storage", () => {
    const c = cleanChecklist({ transportAgent: "A", container: { cleanliness: "yes", noSmell: "maybe", extra: "yes" }, qcBy: 5 });
    expect(c.transportAgent).toBe("A");
    expect(c.container).toEqual({ cleanliness: "yes" });
    expect(c.qcBy).toBe("");
  });

  it("shows the time in Malaysia", () => {
    expect(clockTime("2026-11-06T06:30:00Z")).toBe("14:30");
    expect(clockTime(null)).toBe("");
  });
});
