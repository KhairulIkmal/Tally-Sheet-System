import { describe, expect, it } from "vitest";
import { addMonths, countByDay, filterParams, monthGrid, parseFilter, rangeBounds, rangeLabel } from "./filters";
import { toggleOne } from "@/components/office/date-sidebar";

// 2026-10-14 01:30 in Kuala Lumpur (still the 13th in UTC).
const NOW = new Date("2026-10-13T17:30:00Z");

describe("parseFilter", () => {
  it("opens on the last 7 days in KL time", () => {
    expect(parseFilter({}, NOW)).toMatchObject({ from: "2026-10-08", to: "2026-10-14", form: "all", status: "all" });
  });

  it("reads a range, swapping it when reversed", () => {
    expect(parseFilter({ from: "2026-10-11", to: "2026-10-06" }, NOW)).toMatchObject({ from: "2026-10-06", to: "2026-10-11" });
    expect(parseFilter({ from: "2026-10-06" }, NOW)).toMatchObject({ from: "2026-10-06", to: "2026-10-06" });
  });

  it("ignores impossible days and reads all dates", () => {
    expect(parseFilter({ from: "2026-02-30" }, NOW)).toMatchObject({ from: "2026-10-08" });
    expect(parseFilter({ all: "1", from: "2026-10-06" }, NOW)).toMatchObject({ from: null, to: null });
  });
});

describe("filterParams", () => {
  it("leaves out the defaults and round-trips", () => {
    expect(filterParams(parseFilter({}, NOW), NOW).toString()).toBe("");
    const f = parseFilter({ from: "2026-10-06", to: "2026-10-11", form: "lorry", status: "printed", q: "WXY" }, NOW);
    expect(parseFilter(Object.fromEntries(filterParams(f, NOW)), NOW)).toEqual(f);
    expect(filterParams({ ...f, from: null, to: null }, NOW).get("all")).toBe("1");
  });
});

it("rangeBounds covers whole KL days", () => {
  expect(rangeBounds({ from: "2026-10-06", to: "2026-10-11" })).toEqual({
    since: "2026-10-05T16:00:00.000Z",
    until: "2026-10-11T16:00:00.000Z",
  });
  expect(rangeBounds({ from: null, to: null })).toBeNull();
});

it("monthGrid starts weeks on Monday", () => {
  const weeks = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
  expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  expect(weeks.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  expect(addMonths("2026-12", 1)).toBe("2027-01");
  expect(addMonths("2026-01", -1)).toBe("2025-12");
});

it("countByDay counts in KL time", () => {
  expect(countByDay(["2026-10-13T17:30:00Z", "2026-10-14T03:00:00+00:00", "2026-10-13T15:59:00Z"])).toEqual({
    "2026-10-14": 2,
    "2026-10-13": 1,
  });
});

it("rangeLabel", () => {
  expect(rangeLabel("2026-10-06", "2026-10-11", NOW)).toBe("6 – 11 Oct");
  expect(rangeLabel("2026-09-28", "2026-10-03", NOW)).toBe("28 Sep – 3 Oct");
  expect(rangeLabel("2026-10-14", "2026-10-14", NOW)).toBe("14 Oct");
  expect(rangeLabel("2025-12-30", "2026-01-02", NOW)).toBe("30 Dec 2025 – 2 Jan 2026");
  expect(rangeLabel(null, null, NOW)).toBe("All dates");
});

it("toggleOne can turn both off", () => {
  const both: ["container", "lorry"] = ["container", "lorry"];
  expect(toggleOne("all", "lorry", both)).toBe("container");
  expect(toggleOne("container", "lorry", both)).toBe("all");
  expect(toggleOne("container", "container", both)).toBe("none");
  expect(toggleOne("none", "lorry", both)).toBe("lorry");
});

it("keeps 'none' in the URL", () => {
  const f = parseFilter({ form: "none", status: "none" }, NOW);
  expect(f).toMatchObject({ form: "none", status: "none" });
  expect(filterParams(f, NOW).toString()).toBe("form=none&status=none");
});
