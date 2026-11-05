/** The two paper forms. */
export type SheetForm = "container" | "lorry";

/** Pallet type on the lorry form: Lam Soon 4-way or 2-way, ECR, Loscam, Others. */
export type PltType = "L4" | "L2" | "E" | "C" | "O";
export const PLT_TYPES: readonly PltType[] = ["L4", "L2", "E", "C", "O"];
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

/** A stored PLT type's full name, including the old "L". */
export function pltTypeName(code: string | null | undefined): string {
  if (!code) return "";
  return code === OLD_LAM_SOON ? "LAM SOON" : (PLT_TYPE_NAMES[code as PltType] ?? code);
}

/** "L4WAY 3 · OTHERS 1 (PLASTIC)" from a sheet's counts, in form order. */
export function pltSummary(counts: Record<string, number>, otherNote: string): string {
  return (
    [OLD_LAM_SOON, ...PLT_TYPES]
      .filter((k) => counts[k])
      .map((k) => `${pltTypeName(k)} ${counts[k]}${k === "O" && otherNote.trim() ? ` (${otherNote.trim().toUpperCase()})` : ""}`)
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
