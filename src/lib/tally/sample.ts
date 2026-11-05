import type { PltType } from "./constants";
import { newDraft, newId, type Draft, type DraftItem } from "./draft";
import { todayPaperDate } from "./dates";

// name, unit, target, qtys, expired, prod, batches (one per pallet, the last repeats)
const ITEMS: [string, string, number, number[], string, string, string[]][] = [
  ["36X240G DAISY MARG", "CTN", 160, [40, 40, 40, 40], "16/05/27", "17/05/26", ["1261705203", "1161705203"]],
  ["24X480G DAISY MARG", "CTN", 120, [40, 40, 40], "14/05/27", "13/05/26", ["0381505203"]],
  ["12X1KG DAISY MARG", "CTN", 80, [54, 26], "07/11/28", "08/05/26", ["0260805103"]],
  ["18KG DAISY MARG-TIN", "TIN", 100, [48, 48, 4], "02/05/27", "03/05/26", ["03305"]],
  ["2X4.8KG DAISY MARG", "CTN", 86, [32, 32, 22], "11/03/27", "12/03/26", ["08613021", "09613021"]],
];

// Lorry: name, unit, target, qtys, expired, prod, batch, PLT type per pallet (the last repeats)
const LORRY_ITEMS: [string, string, number, number[], string, string, string, PltType[]][] = [
  ["24X480G DAISY MARG", "CTN", 140, [40, 40, 40, 20], "14/05/27", "13/05/26", "0381505203", ["L4", "L4", "L2", "C"]],
  ["12X1KG DAISY MARG", "CTN", 108, [54, 54], "07/11/28", "08/05/26", "0260805103", ["L4"]],
  ["18KG DAISY MARG-TIN", "TIN", 96, [48, 48], "02/05/27", "03/05/26", "03305", ["E"]],
  ["16KG LS SHTG BLUE LB", "CTN", 60, [60], "07/04/27", "08/04/26", "01202", ["O"]],
];

// Full lorry: every one of the 25 rows used, all PLT types, two contracts.
const LORRY_FULL_ITEMS: [string, string, number, number[], string, string, string, PltType[]][] = [
  ["24X480G DAISY MARG", "CTN", 200, [40, 40, 40, 40, 40], "14/05/27", "13/05/26", "0381505203", ["L4", "L4", "L4", "L4", "C"]],
  ["12X1KG DAISY MARG", "CTN", 216, [54, 54, 54, 54], "07/11/28", "08/05/26", "0260805103", ["L4"]],
  ["18KG DAISY MARG-TIN", "TIN", 192, [48, 48, 48, 48], "02/05/27", "03/05/26", "03305", ["E"]],
  ["36X240G DAISY MARG", "CTN", 160, [40, 40, 40, 40], "16/05/27", "17/05/26", "1261705203", ["L2"]],
  ["2X4.8KG DAISY MARG", "CTN", 150, [32, 32, 32, 32, 22], "11/03/27", "12/03/26", "08613021", ["L4", "L4", "L4", "L4", "O"]],
  ["16KG LS SHTG BLUE LB", "CTN", 120, [60, 60], "07/04/27", "08/04/26", "01202", ["C"]],
  ["6X2.5KG DAISY MARG", "CTN", 52, [52], "07/10/28", "08/04/26", "0460804203", ["L4"]],
];

// Full container: all 25 rows, with short pallets in the middle of an item as well as at its end.
const CONTAINER_FULL_ITEMS: [string, string, number, number[], string, string, string[]][] = [
  ["36X240G DAISY MARG", "CTN", 200, [40, 40, 40, 40, 40], "16/04/27", "17/04/26", ["1261704203", "1161704203"]],
  ["24X480G DAISY MARG", "CTN", 182, [40, 40, 22, 40, 40], "14/04/27", "13/04/26", ["0381504203", "0361504203"]],
  ["12X1KG DAISY MARG", "CTN", 134, [54, 26, 54], "07/10/28", "08/04/26", ["0260804103"]],
  ["18KG DAISY MARG-TIN", "TIN", 150, [48, 48, 48, 6], "02/04/27", "03/04/26", ["03303"]],
  ["6X2.5KG DAISY MARG", "CTN", 100, [48, 4, 48], "07/10/28", "08/04/26", ["0460804203"]],
  ["2X4.8KG DAISY MARG", "CTN", 118, [32, 32, 22, 32], "11/02/27", "12/02/26", ["08612021", "09612021"]],
  ["16KG LS SHTG BLUE LB", "CTN", 40, [40], "07/04/27", "08/04/26", ["01202"]],
];

const items = (rows: [string, string, number, number[], string, string, string[], PltType[], string][]): DraftItem[] =>
  rows.map(([name, unit, targetQty, qtys, expired, prod, batches, types, contractNo]) => ({
    id: newId(),
    name,
    unit,
    targetQty,
    qtyPerPallet: qtys[0],
    pallets: qtys.map((qty, j) => ({
      id: newId(),
      pltType: types[Math.min(j, types.length - 1)],
      contractNo,
      remark: "",
      lines: [{ qty: String(qty), batch: batches[Math.min(j, batches.length - 1)], expired, prod }],
    })),
  }));

/**
 * A complete sheet that only needs signing, for demos: /worker?sample=1 opens
 * a container sheet, /worker?sample=lorry a lorry one and
 * /worker?sample=lorry-full a lorry one with all 25 rows and every box at the
 * foot filled, and /worker?sample=container-full the same for a container
 * (with short pallets in the middle of items). It replaces the draft on this phone.
 */
export function sampleDraft(now: Date = new Date(), form: "container" | "container-full" | "lorry" | "lorry-full" = "container"): Draft {
  if (form === "container-full") {
    const d = newDraft("container", now);
    Object.assign(d.header, {
      contractNo: "8900003295",
      containerNo: "TGCU 2174712",
      sealNo: "PK 2353315",
      siNo: "8106101",
      disport: "MUARA, BRUNEI",
      date: todayPaperDate(now),
    });
    d.items = items(CONTAINER_FULL_ITEMS.map(([n, u, t, q, e, p, b]) => [n, u, t, q, e, p, b, ["L4"], ""]));
    // The last pallet carries two batches, like a mixed pallet on paper.
    const mixed = d.items[d.items.length - 1].pallets[0];
    mixed.lines = [
      { ...mixed.lines[0], qty: "24" },
      { ...mixed.lines[0], qty: "16", batch: "01203" },
    ];
    mixed.remark = "MIXED BATCH";
    d.items[1].pallets[2].remark = "SHORT, BAL NEXT PLT";
    Object.assign(d.materials, {
      SAMPLE: 2,
      "EMPTY CTN": 5,
      "PE BAG": 3,
      "WOODEN FRAME": 1,
      PLYWOOD: 2,
      LINER: 1,
      "LAYER PAD": 25,
      "AIR BAG": 4,
      POLYFOAM: 11,
    });
    d.remark = "2 CTN 12X1KG DAISY MARG TAKEN FOR SAMPLE BY QC";
    return d;
  }
  if (form === "lorry-full") {
    const d = newDraft("lorry", now);
    Object.assign(d.header, { transferTo: "SHAH ALAM DC", doNo: "DO-2610-0458", lorryNo: "JTR 4821", date: todayPaperDate(now) });
    d.items = items(LORRY_FULL_ITEMS.map(([n, u, t, q, e, p, b, ty], i) => [n, u, t, q, e, p, [b], ty, i < 4 ? "LS-24117" : "LS-24118"]));
    // The last pallet carries two batches, like a mixed pallet on paper.
    const mixed = d.items[d.items.length - 1].pallets[0];
    mixed.lines = [
      { ...mixed.lines[0], qty: "32" },
      { ...mixed.lines[0], qty: "20", batch: "0460804204" },
    ];
    mixed.remark = "MIXED BATCH";
    d.items[1].pallets[3].remark = "WRAP TORN, REWRAPPED";
    d.checks.SAMPLE = { qty: 2, note: "FOR QC" };
    d.checks["EMPTY CTN"] = { qty: 5, note: "SPARE FOR DC" };
    d.checks.OTHERS = { qty: 1, note: "PALLET JACK" };
    d.items[4].pallets[4].remark = "PLASTIC PALLET";
    d.remark = "LORRY ARRIVED 2.30PM, LOADED BY BAY 3";
    return d;
  }

  if (form === "lorry") {
    const d = newDraft("lorry", now);
    Object.assign(d.header, { transferTo: "SHAH ALAM DC", doNo: "DO-2610-0457", lorryNo: "JTR 4821", date: todayPaperDate(now) });
    d.items = items(LORRY_ITEMS.map(([n, u, t, q, e, p, b, ty]) => [n, u, t, q, e, p, [b], ty, "LS-24117"]));
    d.checks.SAMPLE = { qty: 2, note: "FOR QC" };
    d.items[3].pallets[0].remark = "PLASTIC PALLET";
    return d;
  }

  const d = newDraft("container", now);
  Object.assign(d.header, {
    contractNo: "8900003290",
    containerNo: "TGCU 2174700",
    sealNo: "PK 2353300",
    siNo: "8106092",
    disport: "MUARA, BRUNEI",
    date: todayPaperDate(now),
  });
  d.items = items(ITEMS.map(([n, u, t, q, e, p, b]) => [n, u, t, q, e, p, b, ["L4"], ""]));
  d.materials.LINER = 1;
  d.materials.POLYFOAM = 8;
  return d;
}
