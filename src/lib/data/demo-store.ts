import "server-only";

import type { PltType } from "@/lib/tally/constants";
import { submitPayloadSchema, type SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";
import { rangeStart } from "./filters";
import { StoreError, type Product, type TallyStore } from "./types";

/**
 * In-memory store for local development (TALLY_DEMO=1). Data lives on
 * globalThis so it survives hot reloads, and is lost when the dev server
 * stops. Mirrors the rules of the tally.* RPCs closely enough to try the
 * flows; the database is still the authority in production.
 */

export const DEMO_USERS = {
  worker: { id: "00000000-0000-4000-8000-000000000001", name: "Mohd Hafiz Rahman", email: "hafiz@demo.local" },
  office: { id: "00000000-0000-4000-8000-000000000002", name: "Nurul Aina", email: "aina@demo.local" },
} as const;

interface DemoState {
  products: Product[];
  sheets: SheetDetail[];
  counter: Record<string, number>;
}

const g = globalThis as unknown as { __tallyDemo?: DemoState };

const PRODUCTS: [string, string, number][] = [
  ["DEMO MARGARINE 5KG", "10215", 32],
  ["DEMO SHORTENING 16KG", "20431", 40],
  ["DEMO SHORTENING 2KG", "20412", 60],
  ["DEMO BAKERY SHORTENING 20KG", "20455", 36],
  ["DEMO PALM OLEIN 17KG", "30117", 48],
  ["DEMO CANOLA OIL 5L", "30540", 40],
  ["DEMO GHEE 2KG", "40102", 72],
];

// A tiny signature-shaped PNG so seeded sheets print with something signed.
const SEED_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function seed(): DemoState {
  const products = PRODUCTS.map(([name, sku, per], i) => ({
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
    sku,
    ctnPerPallet: per,
    isActive: true,
  }));
  const now = Date.now();
  const sheets: SheetDetail[] = [
    seedSheet(1, "lorry", now - 3 * 3600_000, "printed"),
    seedSheet(2, "container", now - 26 * 3600_000, "submitted"),
  ];
  return { products, sheets, counter: { [period(new Date())]: 2 } };
}

function seedSheet(n: number, form: "container" | "lorry", at: number, status: "submitted" | "printed"): SheetDetail {
  const isLorry = form === "lorry";
  const pallets = [32, 32, 32, 22].map((q, i) => ({
    palletNo: i + 1,
    itemNo: 1,
    pltType: (isLorry ? (i === 3 ? "C" : "L") : null) as PltType | null,
    contractNo: isLorry ? "LS-DOM-3318" : "",
    remark: q < 32 ? "LOOSE" : "",
    lines: [{ qty: q, batch: "B240915A", expired: "2027-04-16", prod: "2025-04-16" }],
  }));
  const iso = new Date(at).toISOString();
  const date = iso.slice(0, 10);
  return {
    id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    ref: `TS-${period(new Date(at))}-${String(n).padStart(4, "0")}`,
    form,
    date,
    vehicleNo: isLorry ? "WXY 4521" : "TGHU 1234567",
    docNo: isLorry ? "DO-778101" : "LS-EXP-2407",
    totalPallets: 4,
    totalCtn: 118,
    preparedBy: DEMO_USERS.worker.id,
    preparedByName: DEMO_USERS.worker.name,
    submittedAt: iso,
    status,
    header: {
      contractNo: isLorry ? "" : "LS-EXP-2407",
      containerNo: isLorry ? "" : "TGHU 1234567",
      sealNo: isLorry ? "" : "ML-889012",
      siNo: isLorry ? "" : "SI-55821",
      disport: isLorry ? "" : "PORT KLANG",
      transferTo: isLorry ? "SHAH ALAM DC" : "",
      doNo: isLorry ? "DO-778101" : "",
      lorryNo: isLorry ? "WXY 4521" : "",
    },
    remark: "",
    materials: isLorry ? {} : { SAMPLE: 2, "LAYER PAD": 8 },
    checks: isLorry ? { SAMPLE: { qty: 2, note: "FOR QC" } } : {},
    pltCounts: isLorry ? { L: 3, E: 0, C: 1, O: 0 } : {},
    signature: SEED_SIGNATURE,
    signedAt: iso,
    device: "Demo device",
    printedAt: status === "printed" ? iso : null,
    printedByName: status === "printed" ? DEMO_USERS.office.name : null,
    items: [{ itemNo: 1, name: "DEMO MARGARINE 5KG", targetCtn: 118 }],
    pallets,
    events: [
      { event: "submitted", at: iso, actorName: DEMO_USERS.worker.name },
      ...(status === "printed" ? [{ event: "printed" as const, at: iso, actorName: DEMO_USERS.office.name }] : []),
    ],
  };
}

function period(d: Date): string {
  const kl = new Date(d.getTime() + 8 * 3600_000);
  return `${String(kl.getUTCFullYear()).slice(-2)}${String(kl.getUTCMonth() + 1).padStart(2, "0")}`;
}

function state(): DemoState {
  g.__tallyDemo ??= seed();
  return g.__tallyDemo;
}

function summary(s: SheetDetail): SheetSummary {
  const { id, ref, form, date, vehicleNo, docNo, totalPallets, totalCtn, preparedBy, preparedByName, submittedAt, status } = s;
  return { id, ref, form, date, vehicleNo, docNo, totalPallets, totalCtn, preparedBy, preparedByName, submittedAt, status };
}

export function demoStore(actor: { id: string; name: string; roles: string[] }): TallyStore {
  const isOffice = actor.roles.includes("office");
  const isWorker = actor.roles.includes("worker");
  const visible = (s: SheetDetail) => isOffice || (isWorker && s.preparedBy === actor.id);

  return {
    async listProducts(includeInactive) {
      return state()
        .products.filter((p) => includeInactive || p.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async listMySheets(userId, limit) {
      return state()
        .sheets.filter((s) => s.preparedBy === userId && visible(s))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, limit)
        .map(summary);
    },

    async listSheets(filter, limit) {
      const since = rangeStart(filter.range);
      const q = filter.q.trim().toLowerCase();
      return state()
        .sheets.filter(visible)
        .filter((s) => !since || s.submittedAt >= since)
        .filter((s) => filter.form === "all" || s.form === filter.form)
        .filter((s) => filter.status === "all" || s.status === filter.status)
        .filter((s) => !q || [s.ref, s.vehicleNo, s.docNo, s.preparedByName].join(" ").toLowerCase().includes(q))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, limit)
        .map(summary);
    },

    async getSheet(id) {
      const s = state().sheets.find((x) => x.id === id);
      if (!s || !visible(s)) return null;
      return { ...s, events: isOffice ? s.events : [] };
    },

    async submitSheet(payload: SubmitPayload) {
      if (!isWorker) throw new StoreError("You don't have permission to do that.");
      const p = submitPayloadSchema.parse(payload);
      const st = state();
      const existing = st.sheets.find((s) => s.id === p.clientId);
      if (existing) return { id: existing.id, ref: existing.ref, duplicate: true };

      const per = period(new Date());
      st.counter[per] = (st.counter[per] ?? 0) + 1;
      const ref = `TS-${per}-${String(st.counter[per]).padStart(4, "0")}`;
      const isLorry = p.form === "lorry";
      let n = 0;
      const pallets = p.items.flatMap((it, i) =>
        it.pallets.map((pl) => ({
          palletNo: ++n,
          itemNo: i + 1,
          pltType: (isLorry ? pl.pltType : null) as PltType | null,
          contractNo: pl.contractNo,
          remark: pl.remark,
          lines: pl.lines.map((l) => ({ qty: l.qty, batch: l.batch, expired: l.expired, prod: l.prod })),
        })),
      );
      const totalCtn = pallets.reduce((a, pl) => a + pl.lines.reduce((b, l) => b + (l.qty ?? 0), 0), 0);
      const now = new Date().toISOString();
      const sheet: SheetDetail = {
        // The demo store uses the client id as the sheet id, so a retried submit is a duplicate.
        id: p.clientId,
        ref,
        form: p.form,
        date: p.date,
        vehicleNo: isLorry ? p.header.lorryNo : p.header.containerNo,
        docNo: isLorry ? p.header.doNo : p.header.contractNo,
        totalPallets: n,
        totalCtn,
        preparedBy: actor.id,
        preparedByName: actor.name,
        submittedAt: now,
        status: "submitted",
        header: { ...p.header },
        remark: p.remark,
        materials: p.materials,
        checks: p.checks,
        pltCounts: p.pltCounts,
        signature: p.signature,
        signedAt: p.signedAt,
        device: p.device,
        printedAt: null,
        printedByName: null,
        items: p.items.map((it, i) => ({ itemNo: i + 1, name: it.name, targetCtn: it.targetCtn })),
        pallets,
        events: [{ event: "submitted", at: now, actorName: actor.name }],
      };
      st.sheets.push(sheet);
      return { id: sheet.id, ref, duplicate: false };
    },

    async setPrinted(id, printed) {
      if (!isOffice) throw new StoreError("You don't have permission to do that.");
      const s = state().sheets.find((x) => x.id === id);
      if (!s) throw new StoreError("Sheet not found.");
      const now = new Date().toISOString();
      if (printed && s.status === "submitted") {
        Object.assign(s, { status: "printed", printedAt: now, printedByName: actor.name });
        s.events.push({ event: "printed", at: now, actorName: actor.name });
      } else if (!printed && s.status === "printed") {
        Object.assign(s, { status: "submitted", printedAt: null, printedByName: null });
        s.events.push({ event: "unprinted", at: now, actorName: actor.name });
      }
    },

    async saveProduct(input) {
      if (!isOffice) throw new StoreError("You don't have permission to do that.");
      const st = state();
      const name = input.name.trim().toUpperCase();
      if (!name) throw new StoreError("Product name is required.");
      if (st.products.some((p) => p.name === name && p.id !== input.id)) {
        throw new StoreError("A product with that name already exists.");
      }
      if (input.id) {
        const p = st.products.find((x) => x.id === input.id);
        if (!p) throw new StoreError("Product not found.");
        Object.assign(p, { name, sku: input.sku?.trim().toUpperCase() || null, ctnPerPallet: input.ctnPerPallet, isActive: input.isActive });
        return p.id;
      }
      const id = crypto.randomUUID();
      st.products.push({ id, name, sku: input.sku?.trim().toUpperCase() || null, ctnPerPallet: input.ctnPerPallet, isActive: input.isActive });
      return id;
    },
  };
}
