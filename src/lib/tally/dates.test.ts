import { describe, expect, it } from "vitest";
import { formatDateTime, isValidPaperDate, isoToPaperDate, normalizeDate, paperDateToIso, todayPaperDate } from "./dates";

describe("normalizeDate", () => {
  it.each([
    ["160427", "16/04/27"],
    ["16042027", "16/04/27"],
    ["16-4-27", "16/04/27"],
    ["16/04/2027", "16/04/27"],
    ["16.4.27", "16/04/27"],
    [" 1/2/26 ", "01/02/26"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it("leaves impossible dates unchanged so the field can flag them", () => {
    expect(normalizeDate("310227")).toBe("310227");
    expect(normalizeDate("32/01/27")).toBe("32/01/27");
    expect(normalizeDate("12345")).toBe("12345");
    expect(normalizeDate("abc")).toBe("abc");
  });

  it("accepts 29 February only in a leap year", () => {
    expect(normalizeDate("290228")).toBe("29/02/28");
    expect(normalizeDate("290227")).toBe("290227");
  });

  it("returns empty for empty input", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("   ")).toBe("");
  });
});

describe("paper ↔ ISO", () => {
  it("round-trips", () => {
    expect(paperDateToIso("16/04/27")).toBe("2027-04-16");
    expect(isoToPaperDate("2027-04-16")).toBe("16/04/27");
  });

  it("rejects invalid paper dates", () => {
    expect(paperDateToIso("")).toBeNull();
    expect(paperDateToIso("160427")).toBeNull();
    expect(paperDateToIso("31/02/27")).toBeNull();
    expect(isValidPaperDate("31/02/27")).toBe(false);
  });

  it("formats null as empty", () => {
    expect(isoToPaperDate(null)).toBe("");
  });
});

describe("Kuala Lumpur time", () => {
  it("uses UTC+8 for today", () => {
    // 2026-10-13 17:30 UTC is already 14 October in KL.
    expect(todayPaperDate(new Date("2026-10-13T17:30:00Z"))).toBe("14/10/26");
  });

  it("formats timestamps in KL", () => {
    expect(formatDateTime("2026-10-14T07:42:00Z")).toBe("14/10/26 15:42");
    expect(formatDateTime(null)).toBe("");
  });
});
