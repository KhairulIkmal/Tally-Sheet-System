import type { SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  ctnPerPallet: number | null;
  isActive: boolean;
}

export interface ProductInput {
  id: string | null;
  name: string;
  sku: string | null;
  ctnPerPallet: number | null;
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
  listProducts(includeInactive: boolean): Promise<Product[]>;
  /** The caller's own sheets (worker home). */
  listMySheets(userId: string, limit: number): Promise<SheetSummary[]>;
  /** Every sheet the caller may see, filtered (office list). */
  listSheets(filter: SheetFilter, limit: number): Promise<SheetSummary[]>;
  getSheet(id: string): Promise<SheetDetail | null>;
  submitSheet(payload: SubmitPayload): Promise<SubmitResult>;
  setPrinted(id: string, printed: boolean): Promise<void>;
  saveProduct(input: ProductInput): Promise<string>;
}

/** An error whose message is safe to show the user. */
export class StoreError extends Error {}
