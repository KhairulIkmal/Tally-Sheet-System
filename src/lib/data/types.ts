import type { SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";
import type { AuditData } from "@/lib/tally/audit";

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

/** A calendar day in Kuala Lumpur, "YYYY-MM-DD". */
export type KlDate = string;

export interface SheetFilter {
  /** Inclusive day range; both null = all dates. */
  from: KlDate | null;
  to: KlDate | null;
  form: "all" | "container" | "lorry";
  status: "all" | "submitted" | "printed";
  q: string;
}

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
  /** submitted_at of every sheet the caller may see in [since, until), for the calendar's per-day counts. */
  listSubmittedAt(since: string, until: string): Promise<string[]>;
  getSheet(id: string): Promise<SheetDetail | null>;
  submitSheet(payload: SubmitPayload): Promise<SubmitResult>;
  /** A worker's pallet photo, before the sheet is submitted. Already stored counts as done. */
  uploadPalletPhoto(path: string, photo: Blob): Promise<void>;
  setPrinted(id: string, printed: boolean): Promise<void>;
  /** Office: the sheets received in [since, until) and the events of that time and of those sheets (audit log). */
  listAudit(since: string, until: string): Promise<AuditData>;
  /** Office: record opening a sheet (once per person per 30 minutes) or printing a printed one again. */
  logSheetEvent(id: string, event: "viewed" | "reprinted"): Promise<void>;
  /** Office: rename, change unit / qty per pallet, or hide an item history entry. */
  saveHistoryItem(input: HistoryItemInput): Promise<void>;
}

/** An error whose message is safe to show the user. */
export class StoreError extends Error {}
