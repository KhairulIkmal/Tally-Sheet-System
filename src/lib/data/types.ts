import type { SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";

/**
 * An item name that has been used on a submitted sheet. Saved
 * automatically on submit and suggested while a worker types.
 */
export interface HistoryItem {
  id: string;
  name: string;
  unit: string;
  qtyPerPallet: number | null;
  useCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface HistoryItemInput {
  id: string;
  name: string;
  unit: string;
  qtyPerPallet: number | null;
  isActive: boolean;
}

export type DateRange = "today" | "7" | "30" | "all";

export interface SheetFilter {
  range: DateRange;
  form: "all" | "container" | "lorry";
  status: "all" | "submitted" | "printed";
  q: string;
}

export const DEFAULT_FILTER: SheetFilter = { range: "7", form: "all", status: "all", q: "" };

export interface SubmitResult {
  id: string;
  ref: string;
  duplicate: boolean;
}

/**
 * Everything the app reads and writes. Two implementations: Supabase (as
 * the signed-in user, RLS and the tally.* RPCs decide what is allowed)
 * and an in-memory demo store for local development.
 */
export interface TallyStore {
  /** Item history, most recently used first. Hidden items only when includeHidden. */
  listItemHistory(includeHidden: boolean): Promise<HistoryItem[]>;
  /** The caller's own sheets (worker home). */
  listMySheets(userId: string, limit: number): Promise<SheetSummary[]>;
  /** Every sheet the caller may see, filtered (office list). */
  listSheets(filter: SheetFilter, limit: number): Promise<SheetSummary[]>;
  getSheet(id: string): Promise<SheetDetail | null>;
  submitSheet(payload: SubmitPayload): Promise<SubmitResult>;
  setPrinted(id: string, printed: boolean): Promise<void>;
  /** Office: rename, change unit / qty per pallet, or hide an item history entry. */
  saveHistoryItem(input: HistoryItemInput): Promise<void>;
}

/** An error whose message is safe to show the user. */
export class StoreError extends Error {}
