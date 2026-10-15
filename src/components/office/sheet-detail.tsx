"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { setPrintedAction } from "@/lib/data/actions";
import { MATERIALS, PLT_TYPES, materialLabel } from "@/lib/tally/constants";
import { formatDateTime, isoToPaperDate } from "@/lib/tally/dates";
import { formatQty } from "@/lib/tally/draft";
import { itemSummaries, pageCount, paperFromSheet, type SheetDetail } from "@/lib/tally/sheet";
import { PaperPages } from "@/components/paper/paper-sheet";
import { PaperViewer } from "@/components/paper/paper-viewer";
import { FormBadge } from "@/components/worker/ui";
import { STATUS_CHIP } from "./sheets-list";

const EVENT_LABEL = { submitted: "Submitted and signed by", printed: "Marked printed by", unprinted: "Printed mark removed by" } as const;

export function SheetDetailView({ sheet }: { sheet: SheetDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [askPrinted, setAskPrinted] = useState(false);
  const paper = paperFromSheet(sheet);
  const pages = pageCount(paper.rows.length);
  const printed = sheet.status === "printed";
  const chip = STATUS_CHIP[sheet.status];
  const items = itemSummaries(sheet);
  const isContainer = sheet.form === "container";
  const h = sheet.header;

  function togglePrinted(next: boolean) {
    setError("");
    startTransition(async () => {
      const res = await setPrintedAction(sheet.id, next);
      if (!res.ok) setError(res.error);
      else {
        setAskPrinted(false);
        router.refresh();
      }
    });
  }

  const materials = isContainer
    ? MATERIALS.filter((k) => sheet.materials[k]).map((k) => `${materialLabel(k)} ${sheet.materials[k]}`).join(" · ") || "None"
    : [
        ...Object.entries(sheet.checks)
          .filter(([, c]) => c.qty || c.note)
          .map(([k, c]) => `${materialLabel(k)} ${c.qty ?? 0}${c.note ? ` (${c.note})` : ""}`),
        `PLT ${PLT_TYPES.filter((k) => sheet.pltCounts[k]).map((k) => `${k} ${sheet.pltCounts[k]}`).join(" · ") || "0"}`,
      ].join(" · ");

  const meta: [string, string][] = [
    ["Submitted", formatDateTime(sheet.submittedAt)],
    ["Worker", sheet.preparedByName],
    ["Device", sheet.device || "—"],
    ["Sheet date", isoToPaperDate(sheet.date)],
    ...(isContainer
      ? ([
          ["Contract / SI", `${h.contractNo} · ${h.siNo}`],
          ["Seal / Disport", `${h.sealNo} · ${h.disport}`],
        ] as [string, string][])
      : ([
          ["D/O No", h.doNo],
          ["Transfer To", h.transferTo],
        ] as [string, string][])),
  ];

  return (
    <>
      <div data-noprint className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-h-0 flex-col bg-[#5b6270]">
          <div className="flex h-[52px] flex-none items-center gap-2 bg-[#4a5059] px-4 text-white">
            <Link href="/office" className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold">
              <ArrowLeft className="size-4" /> Sheets
            </Link>
            <span className="text-sm font-medium opacity-80">
              {pages > 1 ? `${pages} pages · ` : ""}A4 preview
            </span>
          </div>
          <PaperViewer data={paper} variant="desk" maxFit={1.1} />
        </div>

        <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-line bg-surface">
          <div className="flex flex-col gap-2.5 border-b border-line p-6">
            <div className="flex items-center gap-2">
              <FormBadge form={sheet.form} />
              <span className={cn("flex h-6 items-center rounded-full px-2.5 text-xs font-bold", chip.className)}>{chip.label}</span>
            </div>
            <div className="text-[28px] font-extrabold">{sheet.vehicleNo}</div>
            <div className="font-mono text-[15px] font-semibold text-muted">{sheet.ref}</div>
            <div className="mt-1.5 grid grid-cols-[1fr_1.3fr] gap-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => togglePrinted(!printed)}
                className={cn(
                  "h-12 rounded-[10px] border-[1.5px] text-[15px] font-bold disabled:opacity-50",
                  printed ? "border-chip bg-chip text-body" : "border-field bg-surface text-ink",
                )}
              >
                {printed ? "✓ Printed" : "Mark as printed"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!printed) setAskPrinted(true);
                  setTimeout(() => window.print(), 100);
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary text-base font-bold text-white"
              >
                <Printer className="size-5" />
                {pages > 1 ? `Print (A4 · ${pages} pages)` : "Print (A4)"}
              </button>
            </div>
            {askPrinted && !printed ? (
              <div className="flex items-center gap-2.5 rounded-[10px] border border-warning-border bg-warning-bg px-3 py-2.5 text-sm font-semibold text-warning-ink">
                <span className="flex-1">Printed it? Mark it so other staff know.</span>
                <button type="button" onClick={() => togglePrinted(true)} className="font-bold text-primary">
                  Mark as printed
                </button>
              </div>
            ) : null}
            {error ? <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-ink">{error}</div> : null}
          </div>

          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 border-b border-line px-6 py-[18px] text-[15px] font-medium">
            {meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2.5 px-6 py-[18px]">
            <div className="flex justify-between text-xs font-bold tracking-[.06em] text-muted">
              <span>ITEMS</span>
              <span>
                {sheet.totalPallets} PLT · {formatQty(sheet.qtyByUnit)}
              </span>
            </div>
            {items.map((it) => (
              <div key={it.itemNo} className="flex flex-col gap-1 rounded-[10px] border border-line px-3.5 py-3">
                <div className="flex justify-between gap-2.5">
                  <span className="text-base font-bold">{it.name}</span>
                  <span className="text-base font-extrabold whitespace-nowrap">
                    {it.qty}
                    {it.targetQty ? ` / ${it.targetQty}` : ""} {it.unit}
                  </span>
                </div>
                <div className="text-sm font-medium text-muted">
                  {it.first === it.last ? `Pallet ${it.first}` : `Pallet ${it.first}–${it.last}`} · {it.batches.join(", ") || "No batch"}
                </div>
                {it.mixed.length ? <div className="text-[13px] font-semibold text-primary">{it.mixed.join(" · ")}</div> : null}
              </div>
            ))}

            <div className="mt-1.5 text-xs font-bold tracking-[.06em] text-muted">MATERIALS</div>
            <div className="text-[15px] font-medium">{materials}</div>
            {sheet.remark ? <div className="text-[15px] font-medium text-body">Remark: {sheet.remark}</div> : null}

            {sheet.events.length ? (
              <>
                <div className="mt-1.5 text-xs font-bold tracking-[.06em] text-muted">ACTIVITY</div>
                {[...sheet.events].reverse().map((e, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr] text-sm font-medium">
                    <span className="text-faint">{formatDateTime(e.at)}</span>
                    <span>
                      {EVENT_LABEL[e.event]} {e.actorName}
                    </span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </aside>
      </div>

      <div data-print-area className="hidden">
        <PaperPages data={paper} />
      </div>
    </>
  );
}
