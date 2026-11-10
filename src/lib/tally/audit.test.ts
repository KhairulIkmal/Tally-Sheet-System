import { describe, expect, it } from "vitest";
import {
  checklistConcerns,
  dailySummary,
  durationText,
  logEntries,
  sheetFlags,
  sheetTimeline,
  toCsv,
  type AuditData,
  type AuditEvent,
  type AuditSheet,
} from "./audit";
import { CONTAINER_CHECKS, GOODS_CHECKS, blankChecklist, type Checklist } from "./checklist";

function goodChecklist(): Checklist {
  const c = blankChecklist();
  for (const x of CONTAINER_CHECKS) c.container[x.key] = "yes";
  for (const x of GOODS_CHECKS) c.goods[x.key] = x.key === "cleanliness" || x.key === "sealing" ? "yes" : "no";
  return c;
}

function sheet(over: Partial<AuditSheet> = {}): AuditSheet {
  return {
    id: "s1",
    ref: "TS-2611-0001",
    form: "lorry",
    vehicleNo: "JTR 4821",
    preparedByName: "HAFIZ",
    totalPallets: 9,
    qtyByUnit: { CTN: 300 },
    startedAt: "2026-11-10T01:00:00Z",
    signedAt: "2026-11-10T02:12:00Z",
    submittedAt: "2026-11-10T02:12:30Z",
    status: "submitted",
    checklist: goodChecklist(),
    shortPallets: 0,
    ...over,
  };
}

const ev = (event: AuditEvent["event"], at: string, actorName = "AINA", sheetId = "s1"): AuditEvent => ({ sheetId, event, at, actorName });

describe("durationText", () => {
  it("reads like a person would say it", () => {
    expect(durationText(30_000)).toBe("under 1m");
    expect(durationText(45 * 60_000)).toBe("45m");
    expect(durationText(72 * 60_000)).toBe("1h 12m");
    expect(durationText(120 * 60_000)).toBe("2h");
    expect(durationText(51 * 3600_000)).toBe("2d 3h");
  });
});

describe("checklistConcerns", () => {
  it("a well-filled page 2 has none", () => {
    expect(checklistConcerns(goodChecklist())).toEqual([]);
    expect(checklistConcerns(null)).toEqual([]);
  });
  it("NO on a container check, but not on UPGRADED CONTAINER", () => {
    const c = goodChecklist();
    c.container.noRust = "no";
    c.container.upgraded = "no";
    expect(checklistConcerns(c)).toEqual(["Container / lorry C) NO RUSTY / HOLE: NO"]);
  });
  it("goods: cleanliness or sealing NO, and dents, leaks ... YES", () => {
    const c = goodChecklist();
    c.goods.sealing = "no";
    c.goods.dented = "yes";
    expect(checklistConcerns(c)).toEqual(["Goods B) DENTED: YES", "Goods D) SEALING: NO"]);
  });
});

describe("sheetFlags", () => {
  it("nothing for an ordinary sheet", () => {
    expect(sheetFlags(sheet(), [ev("submitted", "2026-11-10T02:12:30Z")])).toEqual([]);
  });
  it("each thing worth a look, most serious first", () => {
    const c = goodChecklist();
    c.container.noPest = "no";
    const s = sheet({ checklist: c, shortPallets: 2, startedAt: "2026-11-09T20:00:00Z", submittedAt: "2026-11-10T05:00:00Z" });
    const flags = sheetFlags(s, [
      ev("printed", "2026-11-10T06:00:00Z"),
      ev("reprinted", "2026-11-10T07:00:00Z"),
      ev("unprinted", "2026-11-10T08:00:00Z"),
      ev("reprinted", "2026-11-10T09:00:00Z", "AINA", "other sheet"),
    ]);
    expect(flags.map((f) => [f.kind, f.label])).toEqual([
      ["checklist", "1 checklist issue"],
      ["short", "2 short pallets"],
      ["late", "Sent 2h 48m after signing"],
      ["reprinted", "Printed again 1×"],
      ["unprinted", "Printed mark removed 1×"],
      ["long", "Loading 6h 12m"],
    ]);
  });
  it("a sheet started and signed within minutes", () => {
    expect(sheetFlags(sheet({ startedAt: "2026-11-10T02:10:00Z" }), []).map((f) => f.kind)).toEqual(["quick"]);
  });
  it("no loading time without a start (sheets from before page 2)", () => {
    expect(sheetFlags(sheet({ startedAt: null, checklist: null }), [])).toEqual([]);
  });
});

describe("sheetTimeline", () => {
  it("started, signed, received, then what the office did, with the gaps", () => {
    const steps = sheetTimeline(sheet({ submittedAt: "2026-11-10T05:00:00Z" }), [
      ev("reprinted", "2026-11-10T07:00:00Z"),
      ev("submitted", "2026-11-10T05:00:00Z", "HAFIZ"),
      ev("viewed", "2026-11-10T05:30:00Z"),
      ev("printed", "2026-11-10T05:31:00Z"),
    ]);
    expect(steps.map((s) => [s.kind, s.actorName, s.gap?.label ?? ""])).toEqual([
      ["started", "HAFIZ", ""],
      ["signed", "HAFIZ", "Loading 1h 12m"],
      ["submitted", "HAFIZ", "Sent 2h 48m later (offline?)"],
      ["viewed", "AINA", ""],
      ["printed", "AINA", ""],
      ["reprinted", "AINA", ""],
    ]);
    expect(steps[2].gap?.warn).toBe(true);
  });
});

describe("logEntries", () => {
  it("everything in the range, newest first, naming sheets from outside it", () => {
    const data: AuditData = {
      sheets: [sheet()],
      events: [ev("submitted", "2026-11-10T02:12:30Z", "HAFIZ"), ev("printed", "2026-11-10T03:00:00Z", "AINA", "old")],
      others: [{ id: "old", ref: "TS-2611-0000", form: "container", vehicleNo: "TGCU 1" }],
    };
    const out = logEntries(data, "2026-11-10T00:00:00Z", "2026-11-11T00:00:00Z");
    expect(out.map((e) => [e.kind, e.ref])).toEqual([
      ["printed", "TS-2611-0000"],
      ["submitted", "TS-2611-0001"],
      ["signed", "TS-2611-0001"],
      ["started", "TS-2611-0001"],
    ]);
    expect(logEntries(data, "2026-11-10T02:00:00Z", "2026-11-10T02:30:00Z").map((e) => e.kind)).toEqual(["submitted", "signed"]);
  });
});

describe("dailySummary", () => {
  it("per day and worker, with the average loading time", () => {
    const day = (iso: string) => iso.slice(0, 10);
    const rows = dailySummary(
      [
        sheet(),
        sheet({ id: "s2", startedAt: "2026-11-10T03:00:00Z", signedAt: "2026-11-10T03:48:00Z", shortPallets: 1, qtyByUnit: { TIN: 40 } }),
        sheet({ id: "s3", preparedByName: "ALI", startedAt: null }),
        sheet({ id: "s4", submittedAt: "2026-11-09T02:00:00Z" }),
      ],
      day,
    );
    expect(rows.map((r) => [r.day, r.worker, r.sheets, r.pallets, r.qty, r.avgLoadingMs, r.shortPallets])).toEqual([
      ["2026-11-10", "ALI", 1, 9, { CTN: 300 }, null, 0],
      ["2026-11-10", "HAFIZ", 2, 18, { CTN: 300, TIN: 40 }, 60 * 60_000, 1],
      ["2026-11-09", "HAFIZ", 1, 9, { CTN: 300 }, 72 * 60_000, 0],
    ]);
  });
});

describe("toCsv", () => {
  it("quotes, escapes and won't let a cell run as a formula", () => {
    expect(toCsv([["a,b", 'say "hi"', "=SUM(A1)", -5]])).toBe('﻿"a,b","say ""hi""",\'=SUM(A1),-5');
  });
});
