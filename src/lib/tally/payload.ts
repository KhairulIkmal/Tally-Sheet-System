import { z } from "zod";
import { CHECKS, MATERIALS, MAX_ITEMS, MAX_LINES_PER_PALLET, MAX_PALLETS, PLT_TYPES, normalizeUnit } from "./constants";
import { paperDateToIso } from "./dates";
import { pltCounts, toQty, type Draft } from "./draft";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const text = (max: number) => z.string().max(max);

const lineSchema = z.object({
  qty: z.number().int().min(0).max(99999).nullable(),
  batch: text(40),
  expired: isoDate,
  prod: isoDate,
});

const palletSchema = z.object({
  pltType: z.enum(PLT_TYPES as unknown as [string, ...string[]]).nullable(),
  contractNo: text(60),
  remark: text(60),
  lines: z.array(lineSchema).min(1).max(MAX_LINES_PER_PALLET),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unit: z.string().regex(/^[A-Z0-9 .]{1,10}$/),
  targetQty: z.number().int().min(1).max(99999).nullable(),
  qtyPerPallet: z.number().int().min(1).max(99999).nullable(),
  pallets: z.array(palletSchema).min(1),
});

/**
 * What a phone sends to submit a signed sheet. Checked here (server action
 * and demo store) and again, independently, by tally.submit_sheet().
 */
export const submitPayloadSchema = z
  .object({
    clientId: z.string().uuid(),
    form: z.enum(["container", "lorry"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    header: z.object({
      contractNo: text(60),
      containerNo: text(60),
      sealNo: text(60),
      siNo: text(60),
      disport: text(60),
      transferTo: text(80),
      doNo: text(60),
      lorryNo: text(30),
    }),
    items: z.array(itemSchema).min(1).max(MAX_ITEMS),
    materials: z.record(z.string(), z.number().int().min(0).max(9999)),
    checks: z.record(z.string(), z.object({ qty: z.number().int().min(0).max(9999), note: text(60) })),
    pltCounts: z.record(z.string(), z.number().int().min(0).max(MAX_PALLETS)),
    remark: text(300),
    signature: z
      .string()
      .startsWith("data:image/png;base64,")
      .max(300_000),
    signedAt: z.string().datetime({ offset: true }),
    device: text(160),
  })
  .superRefine((p, ctx) => {
    const pallets = p.items.reduce((n, it) => n + it.pallets.length, 0);
    if (pallets > MAX_PALLETS) {
      ctx.addIssue({ code: "custom", message: `A sheet can hold at most ${MAX_PALLETS} pallets.` });
    }
    const required =
      p.form === "container"
        ? (["contractNo", "containerNo", "sealNo", "siNo", "disport"] as const)
        : (["transferTo", "doNo", "lorryNo"] as const);
    for (const key of required) {
      if (!p.header[key].trim()) ctx.addIssue({ code: "custom", path: ["header", key], message: "Required" });
    }
    if (p.form === "lorry") {
      p.items.forEach((it, i) =>
        it.pallets.forEach((pl, j) => {
          if (!pl.pltType) ctx.addIssue({ code: "custom", path: ["items", i, "pallets", j, "pltType"], message: "PLT type required" });
        }),
      );
    }
  });

export type SubmitPayload = z.infer<typeof submitPayloadSchema>;

const up = (s: string) => s.trim().toUpperCase();

/** Turns the on-device draft into the payload the server stores. */
export function draftToPayload(draft: Draft, device: string): SubmitPayload {
  const isLorry = draft.form === "lorry";
  return {
    clientId: draft.clientId,
    form: draft.form,
    date: paperDateToIso(draft.header.date.trim()) ?? new Date().toISOString().slice(0, 10),
    header: {
      contractNo: up(draft.header.contractNo),
      containerNo: up(draft.header.containerNo),
      sealNo: up(draft.header.sealNo),
      siNo: up(draft.header.siNo),
      disport: up(draft.header.disport),
      transferTo: up(draft.header.transferTo),
      doNo: up(draft.header.doNo),
      lorryNo: up(draft.header.lorryNo),
    },
    items: draft.items.map((it) => ({
      name: up(it.name),
      unit: normalizeUnit(it.unit),
      targetQty: it.targetQty && it.targetQty > 0 ? it.targetQty : null,
      qtyPerPallet: it.qtyPerPallet && it.qtyPerPallet > 0 ? it.qtyPerPallet : null,
      pallets: it.pallets.map((p) => ({
        pltType: isLorry ? p.pltType : null,
        contractNo: isLorry ? up(p.contractNo) : "",
        // Remarks are free notes, kept in the case they were typed.
        remark: p.remark.trim(),
        lines: p.lines.map((l) => ({
          qty: l.qty.trim() === "" ? null : toQty(l.qty),
          batch: up(l.batch),
          expired: paperDateToIso(l.expired.trim()),
          prod: paperDateToIso(l.prod.trim()),
        })),
      })),
    })),
    materials: isLorry ? {} : Object.fromEntries(MATERIALS.map((k) => [k, draft.materials[k] ?? 0])),
    checks: isLorry
      ? Object.fromEntries(CHECKS.map((k) => [k, { qty: draft.checks[k].qty ?? 0, note: up(draft.checks[k].note) }]))
      : {},
    pltCounts: isLorry ? pltCounts(draft) : {},
    remark: draft.remark.trim(),
    signature: draft.signature ?? "",
    signedAt: draft.signedAt ?? new Date().toISOString(),
    device: device.slice(0, 160),
  };
}
