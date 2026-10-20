import { newDraft, newId, type Draft } from "./draft";
import { todayPaperDate } from "./dates";

// name, unit, target, qtys, expired, prod, batches (one per pallet, the last repeats)
const ITEMS: [string, string, number, number[], string, string, string[]][] = [
  ["36X240G DAISY MARG", "CTN", 160, [40, 40, 40, 40], "16/05/27", "17/05/26", ["1261705203", "1161705203"]],
  ["24X480G DAISY MARG", "CTN", 120, [40, 40, 40], "14/05/27", "13/05/26", ["0381505203"]],
  ["12X1KG DAISY MARG", "CTN", 80, [54, 26], "07/11/28", "08/05/26", ["0260805103"]],
  ["18KG DAISY MARG-TIN", "TIN", 100, [48, 48, 4], "02/05/27", "03/05/26", ["03305"]],
  ["2X4.8KG DAISY MARG", "CTN", 86, [32, 32, 22], "11/03/27", "12/03/26", ["08613021", "09613021"]],
];

/**
 * A complete container sheet that only needs signing, for demos: opened with
 * /worker?sample=1, it replaces the draft on this phone.
 */
export function sampleDraft(now: Date = new Date()): Draft {
  const d = newDraft("container", now);
  Object.assign(d.header, {
    contractNo: "8900003290",
    containerNo: "TGCU 2174700",
    sealNo: "PK 2353300",
    siNo: "8106092",
    disport: "MUARA, BRUNEI",
    date: todayPaperDate(now),
  });
  d.items = ITEMS.map(([name, unit, targetQty, qtys, expired, prod, batches]) => ({
    id: newId(),
    name,
    unit,
    targetQty,
    qtyPerPallet: qtys[0],
    pallets: qtys.map((qty, j) => ({
      id: newId(),
      pltType: "L" as const,
      contractNo: "",
      remark: "",
      lines: [{ qty: String(qty), batch: batches[Math.min(j, batches.length - 1)], expired, prod }],
    })),
  }));
  d.materials.LINER = 1;
  d.materials.POLYFOAM = 8;
  return d;
}
