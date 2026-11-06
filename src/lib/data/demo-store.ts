import "server-only";

import { submitPayloadSchema, type SubmitPayload } from "@/lib/tally/payload";
import type { SheetDetail, SheetSummary } from "@/lib/tally/sheet";
import { rangeBounds } from "./filters";
import { StoreError, type HistoryItem, type TallyStore } from "./types";

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
  /** Pallet photos as data: URLs, by storage path. */
  photos?: Record<string, string>;
  history: HistoryItem[];
  sheets: SheetDetail[];
  counter: Record<string, number>;
}

// Versioned so a hot reload after a shape change starts from a fresh seed.
const g = globalThis as unknown as { __tallyDemoV2?: DemoState };

// Item names "already used" so the worker sees suggestions while typing.
const HISTORY: [string, string, number][] = [
  ["DEMO MARGARINE 5KG", "CTN", 32],
  ["DEMO SHORTENING 16KG", "TIN", 40],
  ["DEMO PALM OLEIN 17KG", "TIN", 48],
  ["DEMO GHEE 2KG", "CTN", 72],
];

// A small transparent PNG with a pen squiggle, so seeded sheets print signed.
const SEED_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAYAAAA16j4lAAABEUlEQVR4nO3VQQ7CMAxE0d6DG3A47r+DVSVUCZQ4HnsC/0ldkjozaTgOAAAAAAAAAPgNt/vjeT7dsyDJe6mfnu4ZETRSrmPRjjPZmS23M1Dn2SyNBOQS4i6H8KptntlQOgOM3jLuB7F8iMjvZENOzupQss0hXHlJZYCRQDpKXrlh0udbXbwqwJX3VJY8W5q06KwF1eFlbL6iZMUhXJoxczFVeJmbVpactXbqjNkbVYSXvaai5Ow1JQVHh5ENt8GtIPvvFHx8aZTXqXrOmXcoy7W3uumq0KIF/XW5p+jmq4ObKYtiL2aD6AruW3EjT8WMtkZCcQiPcoN2+zKcZ7O1S7lXjjNZ26VYJKBUAAAAAIDAC0OKkfT1ADKQAAAAAElFTkSuQmCC";

function seed(): DemoState {
  const now0 = Date.now();
  const history = HISTORY.map(([name, unit, per], i): HistoryItem => ({
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
    unit,
    qtyPerPallet: per,
    useCount: HISTORY.length - i,
    lastUsedAt: new Date(now0 - i * 86_400_000).toISOString(),
    isActive: true,
  }));
  const now = Date.now();
  const sheets: SheetDetail[] = [
    seedSheet(1, "lorry", now - 3 * 3600_000, "printed"),
    seedSheet(2, "container", now - 26 * 3600_000, "submitted"),
    paperExampleSheet(3, now - 3600_000),
  ];
  return { history, sheets, counter: { [period(new Date())]: 2 } };
}

function seedSheet(n: number, form: "container" | "lorry", at: number, status: "submitted" | "printed"): SheetDetail {
  const isLorry = form === "lorry";
  const pallets = [32, 32, 32, 22].map((q, i) => ({
    palletNo: i + 1,
    itemNo: 1,
    pltType: isLorry ? (i === 3 ? "C" : i === 0 ? "L4" : "O") : null,
    pltOther: isLorry ? ["", "PLASTIC", "BLUE PLASTIC PALLET", ""][i] : "",
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
    qtyByUnit: { CTN: 118 },
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
    pltCounts: isLorry ? { L: 1, E: 0, C: 1, O: 2 } : {},
    pltOtherNote: "",
    signature: SEED_SIGNATURE,
    signedAt: iso,
    device: "Demo device",
    printedAt: status === "printed" ? iso : null,
    printedByName: status === "printed" ? DEMO_USERS.office.name : null,
    items: [{ itemNo: 1, name: "DEMO MARGARINE 5KG", unit: "CTN", targetQty: 118 }],
    pallets,
    events: [
      { event: "submitted", at: iso, actorName: DEMO_USERS.worker.name },
      ...(status === "printed" ? [{ event: "printed" as const, at: iso, actorName: DEMO_USERS.office.name }] : []),
    ],
  };
}

/**
 * A container sheet copied from a real paper tally sheet (Daisy Marg to
 * Brunei): items with a total, pallets that are not full, a mixed set of
 * units, and packing materials. Shows how the printed sheet compares.
 */
function paperExampleSheet(n: number, at: number): SheetDetail {
  const iso = new Date(at).toISOString();
  // name, unit, target, qtys, expired, prod, batches (one per pallet, the last repeats)
  const ITEMS: [string, string, number, number[], string, string, string[]][] = [
    [
      "36X240G DAISY MARG",
      "CTN",
      200,
      [40, 40, 40, 40, 40],
      "2027-04-16",
      "2026-04-17",
      ["1261704203", "1161704203", "1261704203", "1161704203", "1161704203"],
    ],
    ["24X480G DAISY MARG", "CTN", 200, [40, 40, 40, 40, 40], "2027-04-14", "2026-04-13", ["0381504203", "0361504203"]],
    ["12X1KG DAISY MARG", "CTN", 80, [54, 26], "2028-10-07", "2026-04-08", ["0260804103"]],
    ["18KG DAISY MARG-TIN", "TIN", 150, [48, 48, 48, 6], "2027-04-02", "2026-04-03", ["03303"]],
    ["6X2.5KG DAISY MARG", "CTN", 100, [48, 48, 4], "2028-10-07", "2026-04-08", ["0460804203"]],
    ["2X4.8KG DAISY MARG", "CTN", 150, [32, 32, 32, 32, 22], "2027-02-11", "2026-02-12", ["08612021", "08612021", "09612021", "08612021"]],
    ["16KG LS SHTG BLUE LB", "CTN", 40, [40], "2027-04-07", "2026-04-08", ["01202"]],
  ];
  let palletNo = 0;
  const qtyByUnit: Record<string, number> = {};
  const items = ITEMS.map(([name, unit, targetQty], i) => ({ itemNo: i + 1, name, unit, targetQty }));
  const pallets = ITEMS.flatMap(([, unit, , qtys, expired, prod, batches], i) =>
    qtys.map((qty, j) => {
      qtyByUnit[unit] = (qtyByUnit[unit] ?? 0) + qty;
      palletNo += 1;
      return {
        palletNo,
        itemNo: i + 1,
        pltType: null,
        pltOther: "",
        contractNo: "",
        remark: "",
        lines: [{ qty, batch: batches[Math.min(j, batches.length - 1)], expired, prod }],
      };
    }),
  );
  return {
    id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    ref: `TS-${period(new Date(at))}-${String(n).padStart(4, "0")}`,
    form: "container",
    date: "2026-05-11",
    vehicleNo: "TGCU 2174696",
    docNo: "8900003281",
    totalPallets: pallets.length,
    qtyByUnit,
    preparedBy: DEMO_USERS.worker.id,
    preparedByName: DEMO_USERS.worker.name,
    submittedAt: iso,
    status: "submitted",
    header: {
      contractNo: "8900003281",
      containerNo: "TGCU 2174696",
      sealNo: "PK 2353287",
      siNo: "8106085",
      disport: "MUARA, BRUNEI",
      transferTo: "",
      doNo: "",
      lorryNo: "",
    },
    remark: "",
    materials: { LINER: 1, POLYFOAM: 11 },
    checks: {},
    pltCounts: {},
    pltOtherNote: "",
    signature: SEED_SIGNATURE,
    signedAt: iso,
    device: "Demo device",
    printedAt: null,
    printedByName: null,
    items,
    pallets,
    events: [{ event: "submitted", at: iso, actorName: DEMO_USERS.worker.name }],
  };
}

function period(d: Date): string {
  const kl = new Date(d.getTime() + 8 * 3600_000);
  return `${String(kl.getUTCFullYear()).slice(-2)}${String(kl.getUTCMonth() + 1).padStart(2, "0")}`;
}

function state(): DemoState {
  g.__tallyDemoV2 ??= seed();
  return g.__tallyDemoV2;
}

function summary(s: SheetDetail): SheetSummary {
  const { id, ref, form, date, vehicleNo, docNo, totalPallets, qtyByUnit, preparedBy, preparedByName, submittedAt, status } = s;
  return { id, ref, form, date, vehicleNo, docNo, totalPallets, qtyByUnit, preparedBy, preparedByName, submittedAt, status };
}

export function demoStore(actor: { id: string; name: string; roles: string[] }): TallyStore {
  const isOffice = actor.roles.includes("office");
  const isWorker = actor.roles.includes("worker");
  const visible = (s: SheetDetail) => isOffice || (isWorker && s.preparedBy === actor.id);

  return {
    async listItemHistory(includeHidden) {
      return state()
        .history.filter((h) => includeHidden || h.isActive)
        .sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""));
    },

    async listMySheets(userId, limit) {
      return state()
        .sheets.filter((s) => s.preparedBy === userId && visible(s))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, limit)
        .map(summary);
    },

    async listSheets(filter, limit) {
      const bounds = rangeBounds(filter);
      const q = filter.q.trim().toLowerCase();
      return state()
        .sheets.filter(visible)
        .filter((s) => !bounds || (s.submittedAt >= bounds.since && s.submittedAt < bounds.until))
        .filter((s) => filter.form === "all" || s.form === filter.form)
        .filter((s) => filter.status === "all" || s.status === filter.status)
        .filter((s) => !q || [s.ref, s.vehicleNo, s.docNo, s.preparedByName].join(" ").toLowerCase().includes(q))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, limit)
        .map(summary);
    },

    async listSubmittedAt(since, until) {
      return state()
        .sheets.filter(visible)
        .filter((s) => s.submittedAt >= since && s.submittedAt < until)
        .map((s) => s.submittedAt);
    },

    async getSheet(id) {
      const s = state().sheets.find((x) => x.id === id);
      if (!s || !visible(s)) return null;
      return { ...s, events: isOffice ? s.events : [] };
    },

    async uploadPalletPhoto(path, photo) {
      if (!isWorker || !path.startsWith(`${actor.id}/`)) throw new StoreError("You don't have permission to do that.");
      const st = state();
      st.photos ??= {};
      st.photos[path] ??= `data:image/jpeg;base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`;
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
          pltType: isLorry ? pl.pltType : null,
          pltOther: isLorry ? pl.pltOther : "",
          short: pl.short,
          hasPhoto: !!pl.photo,
          photoUrl: (pl.photo && st.photos?.[pl.photo]) || null,
          contractNo: pl.contractNo,
          remark: pl.remark,
          lines: pl.lines.map((l) => ({ qty: l.qty, batch: l.batch, expired: l.expired, prod: l.prod })),
        })),
      );
      const qtyByUnit: Record<string, number> = {};
      p.items.forEach((it, i) => {
        const q = pallets.filter((pl) => pl.itemNo === i + 1).reduce((a, pl) => a + pl.lines.reduce((b, l) => b + (l.qty ?? 0), 0), 0);
        qtyByUnit[it.unit] = (qtyByUnit[it.unit] ?? 0) + q;
      });
      const now = new Date().toISOString();
      // Same as tally.submit_sheet(): every item name goes into the shared history.
      for (const it of p.items) {
        const h = st.history.find((x) => x.name === it.name.trim().toUpperCase());
        if (h)
          Object.assign(h, { unit: it.unit, qtyPerPallet: it.qtyPerPallet ?? h.qtyPerPallet, useCount: h.useCount + 1, lastUsedAt: now });
        else
          st.history.push({
            id: crypto.randomUUID(),
            name: it.name.trim().toUpperCase(),
            unit: it.unit,
            qtyPerPallet: it.qtyPerPallet,
            useCount: 1,
            lastUsedAt: now,
            isActive: true,
          });
      }
      const sheet: SheetDetail = {
        // The demo store uses the client id as the sheet id, so a retried submit is a duplicate.
        id: p.clientId,
        ref,
        form: p.form,
        date: p.date,
        vehicleNo: isLorry ? p.header.lorryNo : p.header.containerNo,
        docNo: isLorry ? p.header.doNo : p.header.contractNo,
        totalPallets: n,
        qtyByUnit,
        preparedBy: actor.id,
        preparedByName: actor.name,
        submittedAt: now,
        status: "submitted",
        header: { ...p.header },
        remark: p.remark,
        materials: p.materials,
        checks: p.checks,
        pltCounts: p.pltCounts,
        pltOtherNote: p.pltOtherNote,
        signature: p.signature,
        signedAt: p.signedAt,
        device: p.device,
        printedAt: null,
        printedByName: null,
        items: p.items.map((it, i) => ({ itemNo: i + 1, name: it.name, unit: it.unit, targetQty: it.targetQty })),
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

    async saveHistoryItem(input) {
      if (!isOffice) throw new StoreError("You don't have permission to do that.");
      const st = state();
      const name = input.name.trim().toUpperCase();
      if (!name) throw new StoreError("Item name is required.");
      if (st.history.some((h) => h.name === name && h.id !== input.id)) throw new StoreError("Another item already has that name.");
      const h = st.history.find((x) => x.id === input.id);
      if (!h) throw new StoreError("Item not found.");
      Object.assign(h, { name, unit: input.unit, qtyPerPallet: input.qtyPerPallet, isActive: input.isActive });
    },
  };
}
