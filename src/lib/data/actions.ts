"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasRole, requireUser, storeFor } from "@/lib/auth/dal";
import { normalizeUnit } from "@/lib/tally/constants";
import { submitPayloadSchema } from "@/lib/tally/payload";
import { StoreError, type SubmitResult } from "./types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; retry?: boolean };

function errorResult(e: unknown, fallback: string): { ok: false; error: string; retry?: boolean } {
  if (e instanceof StoreError) return { ok: false, error: e.message };
  console.error(e);
  // Anything unexpected (network, Supabase down) is worth retrying from the phone's outbox.
  return { ok: false, error: fallback, retry: true };
}

/**
 * Submits a signed sheet. Called straight away when online, and again by
 * the phone's outbox after a dropped connection — submit_sheet() is
 * idempotent on clientId, so a retry never creates a second sheet.
 */
export async function submitSheetAction(payload: unknown): Promise<ActionResult<SubmitResult>> {
  const user = await requireUser();
  if (!hasRole(user, "worker")) return { ok: false, error: "Only a worker can submit a tally sheet." };

  const parsed = submitPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `The sheet is incomplete (${issue?.path.join(".") || "payload"}: ${issue?.message ?? "invalid"}).` };
  }

  try {
    const result = await storeFor(user).submitSheet(parsed.data);
    revalidatePath("/worker");
    revalidatePath("/office");
    return { ok: true, data: result };
  } catch (e) {
    return errorResult(e, "Couldn't reach the server. The sheet is kept on this phone and will be sent again.");
  }
}

export async function setPrintedAction(sheetId: string, printed: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasRole(user, "office")) return { ok: false, error: "Only the office can change this." };
  if (!z.string().uuid().safeParse(sheetId).success) return { ok: false, error: "Sheet not found." };
  try {
    await storeFor(user).setPrinted(sheetId, printed);
    revalidatePath("/office");
    revalidatePath(`/office/sheets/${sheetId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return errorResult(e, "Couldn't update the sheet. Please try again.");
  }
}

const historyItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Item name is required.").max(80),
  unit: z.string().trim().regex(/^[A-Za-z0-9 .]{1,10}$/, "Unit: up to 10 letters or digits."),
  qtyPerPallet: z.number().int().min(1).max(99999).nullable(),
  isActive: z.boolean(),
});

/** Office: correct or hide an entry in the item history workers get suggestions from. */
export async function saveHistoryItemAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasRole(user, "office")) return { ok: false, error: "Only the office can edit the item history." };
  const parsed = historyItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the item details." };
  try {
    await storeFor(user).saveHistoryItem({ ...parsed.data, unit: normalizeUnit(parsed.data.unit) });
    revalidatePath("/office/items");
    revalidatePath("/worker");
    return { ok: true, data: undefined };
  } catch (e) {
    return errorResult(e, "Couldn't save the item. Please try again.");
  }
}
