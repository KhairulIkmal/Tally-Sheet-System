/**
 * Page 2 of the tally sheet: WH-FR-001 Stuffing / Loading Checklist (HACCP,
 * distribution control). Most of its top half comes from page 1; the worker
 * ticks YES / NO for every check, as on the paper form, and names who did what.
 */

export type YesNo = "yes" | "no" | "";

export interface Check {
  key: string;
  /** As printed on the form. */
  label: string;
  /** The words in brackets after it on the form. */
  note?: string;
}

/** 1) Condition of the container / lorry. */
export const CONTAINER_CHECKS = [
  { key: "cleanliness", label: "A) CLEANLINESS", note: "(No Dirty / Oily)" },
  { key: "noSmell", label: "B) NO FOREIGN SMELL", note: "(Odour)" },
  { key: "noRust", label: "C) NO RUSTY / HOLE" },
  { key: "noPest", label: "D) FREE FROM PEST", note: "(Bugs / Cockroach / Ants)" },
  { key: "noWet", label: "E) NO WET / CONDENSE" },
  { key: "flooring", label: "F) FLOORING", note: "(No Nails / Metal / Damage)" },
  { key: "upgraded", label: "G) UPGRADED CONTAINER" },
  { key: "noBreakable", label: "H) NO BREAKABLE ITEMS", note: "(Glass / Hard Plastic)" },
  { key: "others", label: "I) OTHERS", note: "(Lock handle / Rubber gasket / Roof / Canvas) - No Damaged" },
] as const satisfies readonly Check[];

/** 2) Condition of drum / CTNs / tins. */
export const GOODS_CHECKS = [
  { key: "cleanliness", label: "A) CLEANLINESS" },
  { key: "dented", label: "B) DENTED" },
  { key: "rusty", label: "C) RUSTY" },
  { key: "sealing", label: "D) SEALING" },
  { key: "oily", label: "E) OILY" },
  { key: "leakage", label: "F) LEAKAGE" },
  { key: "soiled", label: "G) SOILED" },
  { key: "bulging", label: "H) BULGING" },
  { key: "birdShit", label: "I) BIRD'S SHIT" },
] as const satisfies readonly Check[];

/** The unnumbered third set: what was used and recorded. */
export const PACKING_CHECKS = [
  { key: "photograph", label: "A) PHOTOGRAPH" },
  { key: "plywood", label: "B) PLYWOOD USE / STOPPER" },
  { key: "polyfoam", label: "C) POLYFOAM" },
  { key: "liner", label: "D) CONTAINER LINER" },
  { key: "layerPad", label: "E) LAYER PAD" },
  { key: "airBag", label: "F) AIR BAG" },
  { key: "others", label: "G) OTHERS" },
  { key: "lockSeal", label: "H) LOCK / SEAL" },
] as const satisfies readonly Check[];

export type ContainerKey = (typeof CONTAINER_CHECKS)[number]["key"];
export type GoodsKey = (typeof GOODS_CHECKS)[number]["key"];
export type PackingKey = (typeof PACKING_CHECKS)[number]["key"];

export const CHECKLIST_TEXT_MAX = 60;

export interface Checklist {
  transportAgent: string;
  pList: string;
  liftruckDriver: string;
  forkliftDriver: string;
  stackerStuffer: string;
  container: Partial<Record<ContainerKey, YesNo>>;
  goods: Partial<Record<GoodsKey, YesNo>>;
  /** Only what the worker chose; page 1 fills in the rest (packingFromSheet). */
  packing: Partial<Record<PackingKey, YesNo>>;
  /** °C during stuffing, ambient products only. */
  temperature: string;
  qcBy: string;
  department: string;
}

export function blankChecklist(): Checklist {
  return {
    transportAgent: "",
    pList: "",
    liftruckDriver: "",
    forkliftDriver: "",
    stackerStuffer: "",
    container: {},
    goods: {},
    packing: {},
    temperature: "",
    qcBy: "",
    department: "",
  };
}

/** What page 1 already says about the third set; "" where it can't tell. */
export interface PackingFacts {
  form: "container" | "lorry";
  hasPhoto: boolean;
  materials: Partial<Record<string, number>>;
  sealNo: string;
}

const MATERIAL_OF: Partial<Record<PackingKey, string>> = {
  plywood: "PLYWOOD",
  polyfoam: "POLYFOAM",
  liner: "LINER",
  layerPad: "LAYER PAD",
  airBag: "AIR BAG",
};

export function packingFromSheet(f: PackingFacts): Partial<Record<PackingKey, YesNo>> {
  const out: Partial<Record<PackingKey, YesNo>> = {};
  if (f.hasPhoto) out.photograph = "yes";
  if (f.form === "container") {
    for (const [k, m] of Object.entries(MATERIAL_OF) as [PackingKey, string][]) out[k] = (f.materials[m] ?? 0) > 0 ? "yes" : "no";
    if (f.sealNo.trim()) out.lockSeal = "yes";
  }
  return out;
}

/** The third set as it stands: the worker's choices over what page 1 says. */
export function effectivePacking(c: Checklist, f: PackingFacts): Partial<Record<PackingKey, YesNo>> {
  const out = packingFromSheet(f);
  for (const [k, v] of Object.entries(c.packing) as [PackingKey, YesNo][]) if (v) out[k] = v;
  return out;
}

/** What still has to be filled in before the sheet can be signed. Empty when complete. */
export function checklistMissing(c: Checklist, f: PackingFacts): string[] {
  const missing: string[] = [];
  const unticked = (checks: readonly Check[], values: Partial<Record<string, YesNo>>) => checks.filter((x) => !values[x.key]).length;
  const a = unticked(CONTAINER_CHECKS, c.container);
  const b = unticked(GOODS_CHECKS, c.goods);
  const p = unticked(PACKING_CHECKS, effectivePacking(c, f));
  if (a) missing.push(`Condition of the ${f.form === "lorry" ? "lorry" : "container"}: ${a} not ticked`);
  if (b) missing.push(`Condition of drum / CTNs / tins: ${b} not ticked`);
  if (p) missing.push(`Photograph, packing and seal: ${p} not ticked`);
  if (!c.transportAgent.trim()) missing.push("Transport / Agent is empty");
  if (!c.qcBy.trim()) missing.push("QC / Goods inspections by is empty");
  if (!c.department.trim()) missing.push("Department is empty");
  return missing;
}

/** Everything page 2 prints, formatted. */
export interface ChecklistPaper {
  issuedDate: string;
  siNo: string;
  contract: string;
  transportAgent: string;
  vehicleNo: string;
  products: { name: string; quantity: string; packing: string }[];
  totalQty: string;
  pList: string;
  liftruckDriver: string;
  forkliftDriver: string;
  stackerStuffer: string;
  timeStart: string;
  timeEnd: string;
  container: Partial<Record<ContainerKey, YesNo>>;
  goods: Partial<Record<GoodsKey, YesNo>>;
  packing: Partial<Record<PackingKey, YesNo>>;
  temperature: string;
  qcBy: string;
  department: string;
  checkBy: string;
  /** Page 1's signature, which also signs CHECK BY (as the clerk does on paper). */
  signature: string | null;
}

/** "10/11/26" → "10/11/2026", as the Issued Date is written on the form. */
export function fullYearDate(paperDate: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(paperDate.trim());
  return m ? `${m[1]}/${m[2]}/20${m[3]}` : paperDate;
}

/** A checklist as it comes back from the database or the payload: anything unexpected is dropped. */
export function cleanChecklist(raw: unknown): Checklist {
  const c = blankChecklist();
  if (!raw || typeof raw !== "object") return c;
  const r = raw as Record<string, unknown>;
  const text = (k: keyof Checklist) => (typeof r[k] === "string" ? (r[k] as string).slice(0, CHECKLIST_TEXT_MAX) : "");
  const ticks = <K extends string>(checks: readonly { key: K }[], v: unknown) => {
    const out: Partial<Record<K, YesNo>> = {};
    if (v && typeof v === "object")
      for (const { key } of checks) {
        const x = (v as Record<string, unknown>)[key];
        if (x === "yes" || x === "no") out[key] = x;
      }
    return out;
  };
  return {
    transportAgent: text("transportAgent"),
    pList: text("pList"),
    liftruckDriver: text("liftruckDriver"),
    forkliftDriver: text("forkliftDriver"),
    stackerStuffer: text("stackerStuffer"),
    container: ticks(CONTAINER_CHECKS, r.container),
    goods: ticks(GOODS_CHECKS, r.goods),
    packing: ticks(PACKING_CHECKS, r.packing),
    temperature: text("temperature").slice(0, 10),
    qcBy: text("qcBy"),
    department: text("department"),
  };
}

/** "14:22" from an ISO time, in the company's timezone. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
