"use client";

import { LogOut, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoToPaperDate } from "@/lib/tally/dates";
import { formatQty, totals, vehicleNo, type Draft } from "@/lib/tally/draft";
import type { SheetSummary } from "@/lib/tally/sheet";
import type { OutboxEntry } from "../storage";
import { BottomBar, Button, FormBadge, Scroll, SectionLabel } from "../ui";

const CHIP: Record<string, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-success-bg text-success" },
  printed: { label: "Printed", className: "bg-primary-soft text-primary" },
  pending: { label: "Waiting to sync", className: "bg-warning-bg text-warning-ink" },
  sending: { label: "Sending…", className: "bg-primary-soft text-primary" },
  failed: { label: "Not sent", className: "bg-danger-bg text-danger-ink" },
};

export function HomeScreen({
  userName,
  department,
  initials,
  online,
  draft,
  outbox,
  sending,
  sheets,
  onNew,
  onResume,
  onDiscardDraft,
  onRetry,
  onDiscardOutbox,
  onSignOut,
  officeLink,
}: {
  userName: string;
  department: string;
  initials: string;
  online: boolean;
  draft: Draft | null;
  outbox: OutboxEntry[];
  sending: boolean;
  sheets: SheetSummary[];
  onNew: () => void;
  onResume: () => void;
  onDiscardDraft: () => void;
  onRetry: () => void;
  onDiscardOutbox: (clientId: string) => void;
  onSignOut: () => void;
  officeLink: boolean;
}) {
  const pending = outbox.length;
  const shown = sheets.filter((s) => !outbox.some((o) => o.clientId === s.id));
  const empty = !draft && pending === 0 && shown.length === 0;

  return (
    <>
      <div className="flex flex-none items-center justify-between bg-surface px-4 pt-2 pb-3.5">
        <div className="min-w-0">
          <div className="text-[26px] font-extrabold">Tally Sheet</div>
          <div className="truncate text-sm font-medium text-muted">
            {userName} · {department}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {officeLink ? (
            <a href="/office" className="rounded-lg px-2 py-2 text-sm font-bold text-primary">
              Office
            </a>
          ) : null}
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-primary-soft text-base font-bold text-primary">
            {initials}
          </span>
          <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" className="grid size-10 place-items-center text-muted">
            <LogOut className="size-5" />
          </button>
        </div>
      </div>

      {!online || pending > 0 ? (
        <div className="flex flex-none items-center gap-2.5 bg-[#2b2f36] px-4 py-2.5 text-sm font-semibold text-white">
          <span className={cn("size-2.5 flex-none rounded-full", online ? "bg-[#6f9cff]" : "bg-[#f0b04a]")} />
          <span className="flex-1">
            {online
              ? `${pending} sheet${pending === 1 ? "" : "s"} waiting to sync`
              : `Offline${pending ? ` · ${pending} sheet${pending === 1 ? "" : "s"} waiting to sync` : " · your work is still saved"}`}
          </span>
          {online && pending > 0 ? (
            <button type="button" onClick={onRetry} disabled={sending} className="flex items-center gap-1 font-bold text-[#9dbbff] disabled:opacity-50">
              <RefreshCw className={cn("size-4", sending && "animate-spin")} /> Send now
            </button>
          ) : null}
        </div>
      ) : null}

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="grid h-20 w-[120px] grid-rows-4 gap-1.5 rounded-[10px] border-2 border-dashed border-placeholder p-2.5">
            <span className="rounded-sm bg-line" />
            <span className="w-[70%] rounded-sm bg-line" />
            <span className="rounded-sm bg-line" />
            <span className="w-1/2 rounded-sm bg-line" />
          </div>
          <div className="text-[22px] font-extrabold">No tally sheets yet</div>
          <div className="text-base/[1.45] font-medium text-muted">Start a new sheet when you get the order document and begin counting pallets.</div>
        </div>
      ) : (
        <Scroll className="gap-2.5 p-4">
          {draft ? (
            <>
              <SectionLabel>Draft</SectionLabel>
              <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3.5">
                <div className="flex justify-between">
                  <FormBadge form={draft.form} size="sm" />
                  <span className="flex h-6 items-center rounded-full bg-chip px-2.5 text-xs font-bold">Draft</span>
                </div>
                <div className="text-[21px] font-bold">{vehicleNo(draft) || (draft.form === "container" ? "New container" : "New lorry")}</div>
                <div className="text-sm font-medium text-muted">
                  {[draft.form === "container" ? draft.header.contractNo : draft.header.doNo, draft.header.date, `${totals(draft.items).pallets} pallets`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                  <Button variant="soft" className="h-12 text-base" onClick={onResume}>
                    Continue
                  </Button>
                  <Button variant="secondary" className="h-12 px-4 text-sm text-muted" onClick={onDiscardDraft}>
                    Discard
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {pending > 0 ? <SectionLabel className="mt-1.5">Waiting to send</SectionLabel> : null}
          {outbox.map((o) => {
            const chip = CHIP[o.state === "failed" ? "failed" : sending ? "sending" : "pending"];
            return (
              <div key={o.clientId} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-[14px] border border-line bg-surface px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FormBadge form={o.payload.form} size="sm" />
                  <span className="truncate text-lg font-bold">{o.vehicleNo}</span>
                </div>
                <span className={cn("flex h-6 items-center rounded-full px-2.5 text-xs font-bold", chip.className)}>{chip.label}</span>
                <div className="col-span-2 flex gap-3 text-sm font-medium text-muted">
                  <span>{o.docNo}</span>
                  <span>{o.pallets} pallets</span>
                  <span>{o.qty}</span>
                </div>
                {o.state === "failed" ? (
                  <div className="col-span-2 mt-1 flex flex-col gap-2">
                    <div className="text-sm font-semibold text-danger-ink">{o.error}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="soft" className="h-11 text-sm" onClick={onRetry}>
                        Try again
                      </Button>
                      <Button variant="danger" className="h-11 text-sm" onClick={() => onDiscardOutbox(o.clientId)}>
                        Discard
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {shown.length > 0 ? <SectionLabel className="mt-1.5">Submitted</SectionLabel> : null}
          {shown.map((s) => {
            const chip = CHIP[s.status];
            return (
              <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-[14px] border border-line bg-surface px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FormBadge form={s.form} size="sm" />
                  <span className="truncate text-lg font-bold">{s.vehicleNo}</span>
                </div>
                <span className={cn("flex h-6 items-center rounded-full px-2.5 text-xs font-bold", chip.className)}>{chip.label}</span>
                <div className="col-span-2 flex flex-wrap gap-x-3 text-sm font-medium text-muted">
                  <span>{s.docNo}</span>
                  <span>{isoToPaperDate(s.date)}</span>
                  <span>{s.totalPallets} pallets</span>
                  <span>{formatQty(s.qtyByUnit)}</span>
                </div>
              </div>
            );
          })}
        </Scroll>
      )}

      <BottomBar>
        <Button size="lg" className="w-full rounded-[14px]" onClick={onNew}>
          <Plus className="size-6" strokeWidth={2.5} />
          New tally sheet
        </Button>
      </BottomBar>
    </>
  );
}
