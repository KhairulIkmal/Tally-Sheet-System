"use client";

import { cn } from "@/lib/utils";
import {
  CHECKLIST_TEXT_MAX,
  CONTAINER_CHECKS,
  GOODS_CHECKS,
  PACKING_CHECKS,
  clockTime,
  effectivePacking,
  packingFromSheet,
  type Check,
  type Checklist,
  type YesNo,
} from "@/lib/tally/checklist";
import { draftChecklist, formatQty, packingFacts, totals, type Draft } from "@/lib/tally/draft";
import { BottomBar, Button, Scroll } from "../ui";

type Edit = (fn: (c: Checklist) => void) => void;

/** YES / NO for one check, as on the form. */
function YesNoButtons({ value, label, onChange }: { value: YesNo | undefined; label: string; onChange: (v: YesNo) => void }) {
  return (
    <div className="grid flex-none grid-cols-2 gap-1" role="radiogroup" aria-label={label}>
      {(["yes", "no"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(value === v ? "" : v)}
          className={cn(
            "h-10 w-14 rounded-[9px] text-sm font-extrabold",
            value === v ? "bg-primary text-white dark:text-[#0e1115]" : "border-[1.5px] border-field bg-surface text-ink",
          )}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CheckSet({
  title,
  note,
  checks,
  values,
  auto,
  onSet,
}: {
  title: string;
  note?: string;
  checks: readonly Check[];
  values: Partial<Record<string, YesNo>>;
  /** Ticked from page 1: shown as such until the worker changes it. */
  auto?: Partial<Record<string, YesNo>>;
  onSet: (key: string, v: YesNo) => void;
}) {
  const left = checks.filter((c) => !values[c.key]).length;
  return (
    <section className="flex flex-col rounded-[14px] border border-line bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 py-1.5">
        <h3 className="text-sm font-extrabold tracking-[.02em]">{title}</h3>
        <span className={cn("text-xs font-bold whitespace-nowrap", left ? "text-warning" : "text-success")}>
          {left ? `${left} to tick` : "All ticked ✓"}
        </span>
      </div>
      {note ? <p className="pb-1 text-xs font-semibold text-muted">{note}</p> : null}
      {checks.map((c) => (
        <div key={c.key} className="flex min-h-[52px] items-center gap-2 border-t border-line-soft py-1.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] leading-tight font-bold">{c.label}</span>
            {c.note ? <span className="text-xs leading-tight font-medium text-muted">{c.note}</span> : null}
            {auto?.[c.key] && auto[c.key] === values[c.key] ? (
              <span className="text-xs font-semibold text-success">From page 1</span>
            ) : null}
          </div>
          <YesNoButtons value={values[c.key]} label={c.label} onChange={(v) => onSet(c.key, v)} />
        </div>
      ))}
    </section>
  );
}

function TextField({
  label,
  value,
  required,
  numeric,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  numeric?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">
        {label}
        {required ? <span className="text-danger"> *</span> : <span className="font-medium"> (optional)</span>}
      </span>
      <input
        value={value}
        inputMode={numeric ? "decimal" : "text"}
        autoComplete="off"
        onChange={(e) =>
          onChange(
            (numeric ? e.target.value.replace(/[^0-9.-]/g, "").slice(0, 6) : e.target.value.toUpperCase()).slice(0, CHECKLIST_TEXT_MAX),
          )
        }
        className={cn(
          "h-12 w-full min-w-0 rounded-[10px] border-[1.5px] bg-surface px-3 text-[16px] font-semibold text-ink uppercase outline-none focus:border-primary",
          required && !value.trim() ? "border-warning" : "border-field",
        )}
      />
    </label>
  );
}

/**
 * Page 2: the stuffing / loading checklist (WH-FR-001). Page 1's details are
 * shown, not typed again; the worker ticks every check and names who did the
 * loading. Used as a step of its own and under the paper sheet.
 */
export function ChecklistForm({ draft, onEdit, wide = false }: { draft: Draft; onEdit: Edit; wide?: boolean }) {
  const c = draftChecklist(draft);
  const facts = packingFacts(draft);
  const auto = packingFromSheet(facts);
  const packing = effectivePacking(c, facts);
  const h = draft.header;
  const isLorry = draft.form === "lorry";
  const t = totals(draft.items);
  const set = (k: keyof Checklist) => (v: string) => onEdit((x) => void ((x as unknown as Record<string, string>)[k] = v));
  const fromPage1: [string, string][] = [
    ["Shipping instruction no", isLorry ? "—" : h.siNo || "—"],
    [isLorry ? "D/O no" : "Shipment inst / contract", (isLorry ? h.doNo : h.contractNo) || "—"],
    [isLorry ? "Lorry no" : "Container no", (isLorry ? h.lorryNo : h.containerNo) || "—"],
    ["Products", `${draft.items.length} item${draft.items.length === 1 ? "" : "s"} · ${formatQty(t.qty)}`],
    ["Time start", clockTime(draft.startedAt) || "—"],
    ["Time end", "When you sign"],
  ];

  return (
    <div className={cn("flex flex-col gap-3", wide && "grid grid-cols-2 items-start gap-4")}>
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface-sunken px-3 py-2.5">
          <h3 className="text-sm font-extrabold">From page 1</h3>
          {fromPage1.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-muted">{k}</span>
              <span className="text-right font-bold">{v}</span>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-3 py-3">
          <TextField label="Transport / Agent" value={c.transportAgent} required onChange={set("transportAgent")} />
          <TextField label="P/List (office)" value={c.pList} onChange={set("pList")} />
          <TextField label="Liftruck driver" value={c.liftruckDriver} onChange={set("liftruckDriver")} />
          <TextField label="Forklift driver" value={c.forkliftDriver} onChange={set("forkliftDriver")} />
          <TextField label="Stacker / Stuffer" value={c.stackerStuffer} onChange={set("stackerStuffer")} />
        </section>
        <CheckSet
          title="1) CONDITION OF THE CONTAINER / LORRY"
          checks={CONTAINER_CHECKS}
          values={c.container}
          onSet={(k, v) => onEdit((x) => void (x.container[k as keyof typeof x.container] = v))}
        />
      </div>
      <div className="flex flex-col gap-3">
        <CheckSet
          title="2) CONDITION OF DRUM / CTNS / TINS"
          note="*Should be free from Damage / Contamination"
          checks={GOODS_CHECKS}
          values={c.goods}
          onSet={(k, v) => onEdit((x) => void (x.goods[k as keyof typeof x.goods] = v))}
        />
        <CheckSet
          title="PHOTOGRAPH, PACKING AND SEAL"
          checks={PACKING_CHECKS}
          values={packing}
          auto={auto}
          onSet={(k, v) => onEdit((x) => void (x.packing[k as keyof typeof x.packing] = v))}
        />
        <section className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-3 py-3">
          <TextField
            label="Environment temperature °C during stuffing (ambient products only)"
            value={c.temperature}
            numeric
            onChange={set("temperature")}
          />
          <TextField label="QC / Goods inspections by" value={c.qcBy} required onChange={set("qcBy")} />
          <TextField label="Department" value={c.department} required onChange={set("department")} />
          <p className="text-xs font-medium text-muted">
            Check by (tally clerk) is you, from your signature on page 1. Confirm by (W/H supervisor) is signed on the printed sheet.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Page 2 as a step of its own in the step-by-step. */
export function ChecklistScreen({
  draft,
  onEdit,
  onNext,
  nextLabel = "Next · Review",
}: {
  draft: Draft;
  onEdit: Edit;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <>
      <Scroll className="gap-3 px-4 pt-3 pb-4">
        <ChecklistForm draft={draft} onEdit={onEdit} />
      </Scroll>
      <BottomBar>
        <Button className="w-full" onClick={onNext}>
          {nextLabel}
        </Button>
      </BottomBar>
    </>
  );
}
