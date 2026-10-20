import { describe, expect, it } from "vitest";
import { reviewWarnings, totals, validateHeader } from "./draft";
import { sampleDraft } from "./sample";

describe("sampleDraft", () => {
  it("is complete: a valid header and no review warnings", () => {
    const d = sampleDraft(new Date("2026-10-20T02:00:00Z"));
    expect(validateHeader("container", d.header)).toEqual({});
    expect(reviewWarnings(d)).toEqual([]);
    expect(totals(d.items).pallets).toBe(15);
    expect(d.signature).toBeNull();
  });
});
