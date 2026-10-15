"use client";

import { cn } from "@/lib/utils";
import { MATERIALS, PLT_TYPES, materialLabel } from "@/lib/tally/constants";
import { countStatus, formatQty, itemQty, palletQty, palletRanges, pltCounts, totals, type Draft, type Warning } from "@/lib/tally/draft";
import { BottomBar, Button, Scroll } from "../ui";

const STATUS_TEXT = { none: "text-ink", ok: "text-success", short: "text-warning", over: "text-danger" } as const;

export function ReviewScreen({
  draft,
  warnings,
  onEditHeader,
  onEditItem,
  onEditMaterials,
  onSign,
}: {
  draft: Draft;
  warnings: Warning[];
  onEditHeader: () => void;
  onEditItem: (i: number) => void;
  onEditMaterials: () => void;
  onSign: () => void;
}) {
  const t = totals(draft.items);
  const ranges = palletRanges(draft.items);
  const h = draft.header;
  const blocking = warnings.filter((w) => w.severity === "error");
  const shown = warnings.slice(0, 6);
  const isContainer = draft.form === "container";
  const counts = pltCounts(draft);
  const mats = isContainer
    ? MATERIALS.filter((k) => draft.materials[k]).map((k) => `${materialLabel(k)} ${draft.materials[k]}`).join(" · ") || "No materials"
    : [
        ...Object.entries(draft.checks)
          .filter(([, c]) => c.qty || c.note)
          .map(([k, c]) => `${materialLabel(k)} ${c.qty}${c.note ? ` (${c.note})` : ""}`),
        `PLT ${PLT_TYPES.filter((k) => counts[k]).map((k) => `${k} ${counts[k]}`).join(" · ") || "0"}`,
      ].join(" · ");

  return (
    <>
      <Scroll className="gap-2.5 p-3">
        <div className="grid flex-none grid-cols-2 gap-2">
          <div className="rounded-xl bg-solid px-3.5 py-2.5 text-on-solid">
            <div className="text-[13px] font-semibold opacity-75">Total pallets</div>
            <div className="text-[34px]/[1.1] font-extrabold">{t.pallets}</div>
          </div>
          <div className="rounded-xl bg-solid px-3.5 py-2.5 text-on-solid">
            <div className="text-[13px] font-semibold opacity-75">Total qty</div>
            <div className="truncate text-[34px]/[1.1] font-extrabold">{formatQty(t.qty)}</div>
          </div>
        </div>

        {shown.map((w, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-none items-center gap-2.5 rounded-xl border px-3 py-2.5",
              w.severity === "error" ? "border-danger-border bg-danger-bg" : w.kind === "count" && w.message.includes("over") ? "border-danger-border bg-danger-bg" : "border-warning-border bg-warning-bg",
            )}
          >
            <span className={cn("grid size-[22px] flex-none place-items-center rounded-full text-sm font-extrabold text-white", w.severity === "error" ? "bg-danger" : "bg-warning")}>!</span>
            <div className={cn("flex-1 text-sm/[1.35] font-semibold", w.severity === "error" ? "text-danger-ink" : "text-warning-ink")}>{w.message}</div>
            <button
              type="button"
              onClick={() => (w.itemIndex === null ? onEditMaterials() : onEditItem(w.itemIndex))}
              className="py-2 text-sm font-bold text-primary"
            >
              View
            </button>
          </div>
        ))}
        {warnings.length > 6 ? <div className="text-sm font-semibold text-warning-ink">and {warnings.length - 6} more warnings</div> : null}
        {warnings.length === 0 ? (
          <div className="flex-none rounded-xl border border-success-border bg-success-bg p-3 text-[15px] font-bold text-success">✓ All counts match, no empty fields</div>
        ) : null}

        <div className="grid flex-none grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="text-[13px] font-bold tracking-[.06em] text-muted">HEADER · {isContainer ? "CONTAINER" : "LORRY"}</span>
          <button type="button" onClick={onEditHeader} className="text-sm font-bold text-primary">
            Edit
          </button>
          <span className="col-span-2 text-[17px] font-bold">
            {isContainer ? `${h.containerNo || "—"} · Seal ${h.sealNo || "—"}` : `${h.lorryNo || "—"} · ${h.doNo || "—"}`}
          </span>
          <span className="col-span-2 text-sm font-medium text-muted">
            {(isContainer ? [h.contractNo, h.siNo, h.disport, h.date] : [h.transferTo, h.date]).filter(Boolean).join(" · ")}
          </span>
        </div>

        {draft.items.map((it, i) => {
          const status = countStatus(itemQty(it), it.targetQty, it.unit);
          const batches = [...new Set(it.pallets.flatMap((p) => p.lines.map((l) => l.batch).filter(Boolean)))];
          const firstExp = it.pallets[0]?.lines[0]?.expired;
          return (
            <div key={it.id} className="flex flex-none flex-col gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">{it.name}</span>
                <button type="button" onClick={() => onEditItem(i)} className="text-sm font-bold text-primary">
                  Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {it.pallets.map((p, pi) => {
                  const q = p.lines.map((l) => l.qty || "?").join("+");
                  return (
                    <span
                      key={p.id}
                      className={cn(
                        "flex h-10 min-w-10 flex-col items-center justify-center rounded-[7px] border border-field px-1",
                        p.lines.length > 1 ? "bg-primary-soft" : palletQty(p) ? "bg-surface" : "bg-warning-bg",
                      )}
                    >
                      <span className="font-condensed text-[15px]/none font-extrabold">{ranges[i].start + pi}</span>
                      <span className="text-[11px]/[1.1] font-semibold text-muted">{q}</span>
                    </span>
                  );
                })}
              </div>
              <div className="text-sm font-semibold text-muted">{batches.length ? `${batches.join(", ")}${firstExp ? ` · Exp ${firstExp}` : ""}` : "No batch"}</div>
              <div className={cn("text-[15px] font-extrabold", STATUS_TEXT[status.state])}>{status.label}</div>
            </div>
          );
        })}

        <div className="grid flex-none grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="text-[13px] font-bold tracking-[.06em] text-muted">MATERIALS</span>
          <button type="button" onClick={onEditMaterials} className="text-sm font-bold text-primary">
            Edit
          </button>
          <span className="col-span-2 text-[15px] font-semibold">{mats}</span>
          {draft.remark ? <span className="col-span-2 text-sm font-medium text-muted">Remark: {draft.remark}</span> : null}
        </div>
      </Scroll>
      <BottomBar>
        {blocking.length ? (
          <div className="mb-2 text-center text-sm font-semibold text-danger">Fix {blocking.length === 1 ? "the error" : `the ${blocking.length} errors`} above before signing.</div>
        ) : null}
        <Button className="w-full" disabled={blocking.length > 0} onClick={onSign}>
          {warnings.length ? `Sign anyway (${warnings.length} warning${warnings.length === 1 ? "" : "s"})` : "Correct · Sign"}
        </Button>
      </BottomBar>
    </>
  );
}
