import { DEFAULT_UNIT, type PltChoice } from "@/lib/tally/constants";

/** The "add item" form across the item name and pallet setup screens. */
export interface PickState {
  name: string;
  unit: string;
  total: string;
  per: string;
  pltType: PltChoice;
  pltOther: string;
  contractNo: string;
}

export function blankPick(defaults?: Partial<Pick<PickState, "pltType" | "pltOther" | "contractNo">>): PickState {
  return {
    name: "",
    unit: DEFAULT_UNIT,
    total: "",
    per: "",
    pltType: defaults?.pltType ?? "",
    pltOther: defaults?.pltOther ?? "",
    contractNo: defaults?.contractNo ?? "",
  };
}

/** An item name from the shared history (or this phone's recent list), suggested while typing. */
export interface ItemSuggestion {
  name: string;
  unit: string;
  qtyPerPallet: number | null;
  useCount: number;
}

/**
 * Suggestions for what has been typed so far: names starting with it
 * first, then names with a word starting with it, then any other match.
 * With nothing typed, the most recently used.
 */
export function suggestItems(typed: string, history: ItemSuggestion[], limit = 8): ItemSuggestion[] {
  const q = typed.trim().toUpperCase();
  if (!q) return history.slice(0, limit);
  const rank = (name: string) => (name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : name.includes(q) ? 2 : 3);
  return history
    .map((h, i) => ({ h, i, r: rank(h.name) }))
    .filter((x) => x.r < 3 && x.h.name !== q)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.h);
}
