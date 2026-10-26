"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MoreHorizontal, Printer, Undo2 } from "lucide-react";
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
  // After the print dialog closes: did it come out of the printer? (The browser can't tell.)
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
            {printed ? (
              <div className="mt-1.5 flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-sunken py-2 pr-1.5 pl-3 text-sm font-semibold text-body">
                <span className="grid size-6 flex-none place-items-center rounded-full bg-body text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  Printed by {sheet.printedByName ?? "office"}
                  {sheet.printedAt ? <span className="block text-xs font-medium text-muted">{formatDateTime(sheet.printedAt)}</span> : null}
                </span>
                <UndoPrintedMenu disabled={pending} onUndo={() => togglePrinted(false)} />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setTimeout(() => {
                  window.print();
                  if (!printed) setAskPrinted(true);
                }, 100);
              }}
              className={cn(
                "mt-1.5 flex h-12 items-center justify-center gap-2 rounded-[10px] text-base font-bold",
                printed ? "border-[1.5px] border-field bg-surface text-ink hover:bg-canvas" : "bg-primary text-white",
              )}
            >
              <Printer className="size-5" />
              {printed ? "Print again" : pages > 1 ? `Print (A4 · ${pages} pages)` : "Print (A4)"}
            </button>
            {!printed ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => togglePrinted(true)}
                className="self-center text-sm font-semibold text-muted underline-offset-2 hover:text-primary hover:underline disabled:opacity-50"
              >
                Printed it elsewhere? Mark as printed
              </button>
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

      {askPrinted && !printed ? <PrintedDialog pending={pending} onYes={() => togglePrinted(true)} onNo={() => setAskPrinted(false)} /> : null}

      <div data-print-area className="hidden">
        <PaperPages data={paper} />
      </div>
    </>
  );
}

/** Asked once the print dialog closes: only the person at the printer knows whether it came out. */
function PrintedDialog({ pending, onYes, onNo }: { pending: boolean; onYes: () => void; onNo: () => void }) {
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    yes.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onNo();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNo]);
  return (
    <div
      data-noprint
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(6,16,36,.45)] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onNo()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="printed-q" className="w-full max-w-[380px] rounded-2xl bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,.3)]">
        <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
          <Printer className="size-6" />
        </span>
        <h2 id="printed-q" className="mt-4 text-xl font-extrabold">
          Did it print OK?
        </h2>
        <p className="mt-1 text-[15px] font-medium text-muted">Mark it as printed so other staff know this sheet is done.</p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onNo} className="h-12 rounded-[10px] border-[1.5px] border-field text-[15px] font-bold hover:bg-canvas">
            Not yet
          </button>
          <button ref={yes} type="button" disabled={pending} onClick={onYes} className="h-12 rounded-[10px] bg-primary text-[15px] font-bold text-white disabled:opacity-60">
            Yes, printed
          </button>
        </div>
      </div>
    </div>
  );
}

/** ⋯ on the Printed row: putting a sheet back to Submitted asks first, since everyone sees it. */
function UndoPrintedMenu({ disabled, onUndo }: { disabled: boolean; onUndo: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setConfirm(false);
    };
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div role="menu" className="absolute top-[calc(100%+6px)] right-0 z-40 w-[270px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(16,24,40,.18)]">
          {confirm ? (
            <div className="p-2.5">
              <div className="text-[15px] font-bold">Mark as not printed?</div>
              <p className="mt-0.5 text-sm font-medium text-muted">It goes back to Submitted for all office staff.</p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-lg px-3 text-sm font-bold hover:bg-canvas">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false);
                    setConfirm(false);
                    onUndo();
                  }}
                  className="h-9 rounded-lg bg-danger px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  Mark not printed
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirm(true)}
              className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold text-body hover:bg-canvas"
            >
              <Undo2 className="size-4 text-muted" /> Mark as not printed
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
