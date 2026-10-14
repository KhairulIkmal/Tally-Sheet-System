/** The two paper forms. */
export type SheetForm = "container" | "lorry";

/** Pallet ownership on the lorry form: L - Lam Soon, E - ECR, C - Loscam, O - Others. */
export type PltType = "L" | "E" | "C" | "O";
export const PLT_TYPES: readonly PltType[] = ["L", "E", "C", "O"];
export const PLT_TYPE_NAMES: Record<PltType, string> = {
  L: "Lam Soon",
  E: "ECR",
  C: "Loscam",
  O: "Others",
};

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

/** Tick boxes with a note line at the foot of the lorry form. */
export const CHECKS = ["SAMPLE", "EMPTY CTN", "OTHERS"] as const;
export type CheckKey = (typeof CHECKS)[number];

/** Rows on one printed A4 page, same as the paper form. */
export const ROWS_PER_PAGE = 25;

/** Hard limits, matched by the database checks. */
export const MAX_ITEMS = 50;
export const MAX_PALLETS = 200;
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
