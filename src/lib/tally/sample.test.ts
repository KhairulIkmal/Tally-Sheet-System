import { describe, expect, it } from "vitest";
import { MAX_PALLETS } from "./constants";
import { pltCounts, reviewWarnings, totals, validateHeader } from "./draft";
import { sampleDraft } from "./sample";

describe("sampleDraft", () => {
  it("is complete: a valid header and no review warnings", () => {
    const d = sampleDraft(new Date("2026-10-20T02:00:00Z"));
    expect(validateHeader("container", d.header)).toEqual({});
    expect(reviewWarnings(d)).toEqual([]);
    expect(totals(d.items).pallets).toBe(15);
    expect(d.signature).toBeNull();
  });

  it("has a lorry version: valid header, PLT types counted, no review warnings", () => {
    const d = sampleDraft(new Date("2026-10-20T02:00:00Z"), "lorry");
    expect(d.form).toBe("lorry");
    expect(validateHeader("lorry", d.header)).toEqual({});
    expect(reviewWarnings(d)).toEqual([]);
    expect(totals(d.items).pallets).toBe(9);
    expect(pltCounts(d)).toEqual({ L4: 4, L2: 1, E: 2, C: 1, O: 1 });
  });

  it("has a full container version: all 25 rows, short pallets mid-item, every material, no review warnings", () => {
    const d = sampleDraft(new Date("2026-10-20T02:00:00Z"), "container-full");
    expect(d.form).toBe("container");
    expect(reviewWarnings(d)).toEqual([]);
    expect(totals(d.items).pallets).toBe(MAX_PALLETS);
    expect(d.items[1].pallets.map((p) => p.lines[0].qty)).toEqual(["40", "40", "22", "40", "40"]);
    expect(Object.values(d.materials).every((n) => n > 0)).toBe(true);
  });

  it("has a full lorry version: all 25 rows, every PLT type, every check, no review warnings", () => {
    const d = sampleDraft(new Date("2026-10-20T02:00:00Z"), "lorry-full");
    expect(d.form).toBe("lorry");
    expect(reviewWarnings(d)).toEqual([]);
    expect(totals(d.items).pallets).toBe(MAX_PALLETS);
    expect(pltCounts(d)).toEqual({ L4: 13, L2: 4, E: 4, C: 3, O: 1 });
    expect(Object.values(d.checks).every((c) => c.qty > 0)).toBe(true);
  });
});
