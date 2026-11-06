import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";
import type { SheetForm } from "@/lib/tally/constants";
import { PHOTO_BUCKET } from "@/lib/tally/photos";
import { rangeBounds, safeSearch } from "./filters";
import { StoreError, type HistoryItem, type HistoryItemInput, type SheetFilter, type SubmitResult, type TallyStore } from "./types";

const SUMMARY_COLUMNS =
  "id, ref, form, sheet_date, container_no, lorry_no, contract_no, do_no, total_pallets, qty_by_unit, prepared_by, prepared_by_name, submitted_at, status";

interface SummaryRow {
  id: string;
  ref: string;
  form: SheetForm;
  sheet_date: string;
  container_no: string | null;
  lorry_no: string | null;
  contract_no: string | null;
  do_no: string | null;
  total_pallets: number;
  qty_by_unit: Record<string, number> | null;
  prepared_by: string;
  prepared_by_name: string;
  submitted_at: string;
  status: "submitted" | "printed";
}

function toSummary(r: SummaryRow): SheetSummary {
  return {
    id: r.id,
    ref: r.ref,
    form: r.form,
    date: r.sheet_date,
    vehicleNo: (r.form === "container" ? r.container_no : r.lorry_no) ?? "",
    docNo: (r.form === "container" ? r.contract_no : r.do_no) ?? "",
    totalPallets: r.total_pallets,
    qtyByUnit: r.qty_by_unit ?? {},
    preparedBy: r.prepared_by,
    preparedByName: r.prepared_by_name,
    submittedAt: r.submitted_at,
    status: r.status,
  };
}

/** Maps a Postgres/PostgREST error to a message that is safe to show. */
function fail(error: { message?: string; code?: string } | null, fallback: string): never {
  // Raised by the tally.* RPCs with a user-facing message.
  if (error?.code === "insufficient_privilege" || error?.code === "42501") {
    throw new StoreError("You don't have permission to do that.");
  }
  if (error?.code === "22023" || error?.code === "P0001") {
    throw new StoreError(error.message ?? fallback);
  }
  throw new StoreError(fallback);
}

export function supabaseStore(): TallyStore {
  return {
    async listItemHistory(includeHidden) {
      const supabase = await createClient();
      let query = supabase
        .from("item_history")
        .select("id, name, unit, qty_per_pallet, use_count, last_used_at, is_active")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (!includeHidden) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) fail(error, "Couldn't load the item history.");
      return (data ?? []).map((p): HistoryItem => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        qtyPerPallet: p.qty_per_pallet,
        useCount: p.use_count,
        lastUsedAt: p.last_used_at,
        isActive: p.is_active,
      }));
    },

    async listMySheets(userId, limit) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("sheets")
        .select(SUMMARY_COLUMNS)
        .eq("prepared_by", userId)
        .order("submitted_at", { ascending: false })
        .limit(limit);
      if (error) fail(error, "Couldn't load your sheets.");
      return ((data ?? []) as SummaryRow[]).map(toSummary);
    },

    async listSheets(filter: SheetFilter, limit) {
      const supabase = await createClient();
      let query = supabase.from("sheets").select(SUMMARY_COLUMNS).order("submitted_at", { ascending: false }).limit(limit);
      const bounds = rangeBounds(filter);
      if (bounds) query = query.gte("submitted_at", bounds.since).lt("submitted_at", bounds.until);
      if (filter.form !== "all") query = query.eq("form", filter.form);
      if (filter.status !== "all") query = query.eq("status", filter.status);
      const q = safeSearch(filter.q);
      if (q) {
        const like = `*${q}*`;
        query = query.or(
          ["ref", "container_no", "lorry_no", "contract_no", "do_no", "prepared_by_name"].map((c) => `${c}.ilike.${like}`).join(","),
        );
      }
      const { data, error } = await query;
      if (error) fail(error, "Couldn't load the sheets.");
      return ((data ?? []) as SummaryRow[]).map(toSummary);
    },

    async listSubmittedAt(since, until) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("sheets")
        .select("submitted_at")
        .gte("submitted_at", since)
        .lt("submitted_at", until)
        .limit(5000);
      if (error) fail(error, "Couldn't load the calendar.");
      return ((data ?? []) as { submitted_at: string }[]).map((r) => r.submitted_at);
    },

    async getSheet(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const supabase = await createClient();
      const { data: s, error } = await supabase.from("sheets").select("*").eq("id", id).maybeSingle();
      if (error) fail(error, "Couldn't load the sheet.");
      if (!s) return null;

      const [items, pallets, lines, events] = await Promise.all([
        supabase.from("sheet_items").select("item_no, name, unit, target_qty").eq("sheet_id", id).order("item_no"),
        supabase
          .from("sheet_pallets")
          .select("pallet_no, item_no, plt_type, plt_other, contract_no, remark, photo_path, short")
          .eq("sheet_id", id)
          .order("pallet_no"),
        supabase
          .from("pallet_lines")
          .select("pallet_no, line_no, qty, batch, expired, prod")
          .eq("sheet_id", id)
          .order("pallet_no")
          .order("line_no"),
        // Office only (RLS); a worker gets an empty list.
        supabase.from("sheet_events").select("event, at, actor_name").eq("sheet_id", id).order("at"),
      ]);
      for (const r of [items, pallets, lines]) if (r.error) fail(r.error, "Couldn't load the sheet.");

      const linesByPallet = new Map<number, SheetDetail["pallets"][number]["lines"]>();
      for (const l of lines.data ?? []) {
        const list = linesByPallet.get(l.pallet_no) ?? [];
        list.push({ qty: l.qty, batch: l.batch ?? "", expired: l.expired, prod: l.prod });
        linesByPallet.set(l.pallet_no, list);
      }

      // Photos: links good for an hour, signed only for those the caller may read.
      const photoPaths = (pallets.data ?? []).map((p) => p.photo_path).filter((x): x is string => !!x);
      const photoUrls = new Map<string, string>();
      if (photoPaths.length) {
        const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(photoPaths, 3600);
        for (const x of signed ?? []) if (x.path && x.signedUrl) photoUrls.set(x.path, x.signedUrl);
      }

      return {
        ...toSummary(s as SummaryRow),
        header: {
          contractNo: s.contract_no ?? "",
          containerNo: s.container_no ?? "",
          sealNo: s.seal_no ?? "",
          siNo: s.si_no ?? "",
          disport: s.disport ?? "",
          transferTo: s.transfer_to ?? "",
          doNo: s.do_no ?? "",
          lorryNo: s.lorry_no ?? "",
        },
        remark: s.remark ?? "",
        materials: s.materials ?? {},
        checks: s.checks ?? {},
        pltCounts: s.plt_counts ?? {},
        pltOtherNote: s.plt_other_note ?? "",
        signature: s.signature,
        signedAt: s.signed_at,
        device: s.device ?? "",
        printedAt: s.printed_at,
        printedByName: s.printed_by_name,
        items: (items.data ?? []).map((it) => ({ itemNo: it.item_no, name: it.name, unit: it.unit, targetQty: it.target_qty })),
        pallets: (pallets.data ?? []).map((p) => ({
          palletNo: p.pallet_no,
          itemNo: p.item_no,
          pltType: p.plt_type ?? null,
          pltOther: p.plt_other ?? "",
          short: p.short ?? null,
          hasPhoto: !!p.photo_path,
          photoUrl: p.photo_path ? (photoUrls.get(p.photo_path) ?? null) : null,
          contractNo: p.contract_no ?? "",
          remark: p.remark ?? "",
          lines: linesByPallet.get(p.pallet_no) ?? [],
        })),
        events: (events.data ?? []).map((e) => ({ event: e.event, at: e.at, actorName: e.actor_name ?? "" })),
      };
    },

    async submitSheet(payload: SubmitPayload): Promise<SubmitResult> {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("submit_sheet", { p: payload });
      if (error || !data) fail(error, "Couldn't submit the sheet. Please try again.");
      return { id: data.id, ref: data.ref, duplicate: !!data.duplicate };
    },

    async uploadPalletPhoto(path, photo) {
      const supabase = await createClient();
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false });
      // Sent before and stored: a retry after a dropped connection.
      if (error && !/exists|duplicate/i.test(error.message)) {
        console.error("tally photo upload", error.message);
        throw new Error("Photo upload failed");
      }
    },

    async setPrinted(id, printed) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("set_sheet_printed", { p_sheet_id: id, p_printed: printed });
      if (error) fail(error, "Couldn't update the sheet.");
    },

    async saveHistoryItem(input: HistoryItemInput) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("save_history_item", {
        p_id: input.id,
        p_name: input.name,
        p_unit: input.unit,
        p_qty_per_pallet: input.qtyPerPallet,
        p_is_active: input.isActive,
      });
      if (error) {
        if (error.code === "23505") throw new StoreError("Another item already has that name.");
        fail(error, "Couldn't save the item.");
      }
    },
  };
}
