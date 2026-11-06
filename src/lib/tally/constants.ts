/** The two paper forms. */
export type SheetForm = "container" | "lorry";

/** Pallet type on the lorry form: Lam Soon 4-way or 2-way, ECR, Loscam, Others. */
export type PltType = "L4" | "L2" | "E" | "C" | "O";
export const PLT_TYPES: readonly PltType[] = ["L4", "L2", "E", "C", "O"];
/** A pallet's PLT type on the phone: "" until the worker chooses one. */
export type PltChoice = PltType | "";
/** The full names, as written on the sheet. */
export const PLT_TYPE_NAMES: Record<PltType, string> = {
  L4: "L4WAY",
  L2: "L2WAY",
  E: "ECR",
  C: "LOSCAM",
  O: "OTHERS",
};
/** Sheets from before Lam Soon pallets were split into 4-way and 2-way say only "L". */
export const OLD_LAM_SOON = "L";

/** Longest "type of pallet" for an Others pallet: it is written in the narrow PLT TYPE cell. */
export const PLT_OTHER_MAX = 20;

/** What the PLT TYPE cell says: what an Others pallet was when the worker wrote it, else the full name. */
export function pltCellText(code: string | null | undefined, other: string | null | undefined): string {
  const written = (other ?? "").trim().toUpperCase();
  return code === "O" && written ? written : pltTypeName(code);
}

/** The note on the L box: how many Lam Soon pallets of each way ("4W 16 · 2W 6"). */
export function lamSoonWayList(pallets: readonly { pltType: string | null }[]): string {
  const count = (type: string) => pallets.filter((p) => p.pltType === type).length;
  const four = count("L4");
  const two = count("L2");
  return [four ? `4W ${four}` : "", two ? `2W ${two}` : ""].filter(Boolean).join(" · ");
}

/** The note on the OTHERS box: each type of Others pallet written on the sheet, with how many ("PLASTIC 2 · WOOD 1"). */
export function otherPalletList(pallets: readonly { pltType: string | null; pltOther?: string | null }[]): string {
  const found = new Map<string, number>();
  for (const p of pallets) {
    const type = (p.pltOther ?? "").trim().toUpperCase();
    if (p.pltType === "O" && type) found.set(type, (found.get(type) ?? 0) + 1);
  }
  return [...found].map(([type, n]) => `${type} ${n}`).join(" · ");
}

/** The boxes of TOTAL NUMBER OF PLT, as on the paper form: both kinds of Lam Soon pallet count under L. */
export type PltGroup = "L" | "E" | "C" | "O";
export const PLT_GROUPS: readonly PltGroup[] = ["L", "E", "C", "O"];
export const PLT_GROUP_NAMES: Record<PltGroup, string> = { L: "Lam Soon", E: "ECR", C: "Loscam", O: "Others" };
export const PLT_LABELS: Record<PltGroup, string> = {
  L: "L - (LAM SOON)",
  E: "E - (ECR)",
  C: "C - (LOSCAM)",
  O: "O - (OTHERS)",
};

export function pltGroup(type: PltChoice): PltGroup | "" {
  return type === "L4" || type === "L2" ? "L" : type;
}

/** A stored count for one box. A few sheets were stored with L4 and L2 counted apart. */
export function storedPltCount(counts: Record<string, number>, group: PltGroup): number {
  return group === "L" ? (counts.L ?? 0) + (counts.L4 ?? 0) + (counts.L2 ?? 0) : (counts[group] ?? 0);
}

/** A stored PLT type's full name, including the old "L". */
export function pltTypeName(code: string | null | undefined): string {
  if (!code) return "";
  return code === OLD_LAM_SOON ? "LAM SOON" : (PLT_TYPE_NAMES[code as PltType] ?? code);
}

/** "L 3 (4W 3) · O 1 (WOOD 1)" from a sheet's counts and the notes on its boxes, in form order. */
export function pltSummary(counts: Record<string, number>, otherNote = "", wayNote = ""): string {
  const noteOf = (k: PltGroup) => (k === "O" ? otherNote.trim().toUpperCase() : k === "L" ? wayNote : "");
  return (
    PLT_GROUPS.filter((k) => storedPltCount(counts, k))
      .map((k) => `${k} ${storedPltCount(counts, k)}${noteOf(k) ? ` (${noteOf(k)})` : ""}`)
      .join(" · ") || "0"
  );
}

/** Packing-material count boxes at the foot of the container form, in paper order. */
export const MATERIALS = [
  "SAMPLE",
  "EMPTY CTN",
  "PE BAG",
  "WOODEN FRAME",
  "PLYWOOD",
  "LINER",
  "LAYER PAD",
  "AIR BAG",
  "POLYFOAM",
] as const;
export type MaterialKey = (typeof MATERIALS)[number];
/** The paper has two sets of boxes: this many of MATERIALS in the first (Sample to Wooden Frame), the rest in the second. */
export const MATERIALS_FIRST_BOXES = 4;

/** Tick boxes with a note line at the foot of the lorry form. */
export const CHECKS = ["SAMPLE", "EMPTY CTN", "OTHERS"] as const;
export type CheckKey = (typeof CHECKS)[number];

/** Rows on one printed A4 page, same as the paper form. */
export const ROWS_PER_PAGE = 25;

/** Hard limits, matched by the database checks. */
export const MAX_ITEMS = 50;
/** A sheet is one paper form: 25 pallet rows, never more. */
export const MAX_PALLETS = 25;
export const MAX_LINES_PER_PALLET = 6;

export const FORM_LABEL: Record<SheetForm, string> = {
  container: "Container",
  lorry: "Lorry",
};

export const COMPANY_TIMEZONE = "Asia/Kuala_Lumpur";

/** "EMPTY CTN" → "Empty CTN", "PE BAG" → "PE bag" for on-screen labels. */
export function materialLabel(key: string): string {
  return key
    .split(" ")
    .map((w, i) => (w === "CTN" || w === "PE" ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
}

/** Quick choices for an item's unit; workers can also type their own. */
export const QUICK_UNITS = ["CTN", "TIN"] as const;
export const DEFAULT_UNIT = "CTN";

/** "tin " → "TIN"; empty → CTN. Max 10 characters, letters/digits/space/dot only. */
export function normalizeUnit(value: string | null | undefined): string {
  const u = (value ?? "").toUpperCase().replace(/[^A-Z0-9 .]/g, "").trim().slice(0, 10);
  return u || DEFAULT_UNIT;
}
