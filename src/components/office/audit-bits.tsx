import { AlertTriangle, CircleDot, Eye, FileCheck2, Info, PenLine, Play, Printer, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/tally/dates";
import { KIND_LABEL, type AuditKind, type Flag, type TimelineStep } from "@/lib/tally/audit";

const TONE = {
  danger: "border-danger-border bg-danger-bg text-danger-ink",
  warning: "border-warning-border bg-warning-bg text-warning-ink",
  info: "border-line bg-surface-sunken text-body",
} as const;

/** The flags of one sheet as small chips; the detail shows on hover. */
export function FlagChips({ flags, className }: { flags: Flag[]; className?: string }) {
  if (!flags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {flags.map((f) => (
        <span
          key={f.kind}
          title={f.detail}
          className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-bold whitespace-nowrap", TONE[f.tone])}
        >
          {f.tone === "info" ? <Info className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {f.label}
        </span>
      ))}
    </div>
  );
}

export const KIND_ICON: Record<AuditKind, typeof Play> = {
  started: Play,
  signed: PenLine,
  submitted: Send,
  viewed: Eye,
  printed: Printer,
  reprinted: FileCheck2,
  unprinted: RotateCcw,
};

export const KIND_COLOUR: Record<AuditKind, string> = {
  started: "bg-surface-sunken text-body",
  signed: "bg-primary-soft text-primary",
  submitted: "bg-success-bg text-success",
  viewed: "bg-surface-sunken text-muted",
  printed: "bg-[#e8ecf4] text-[#2a3a5c] dark:bg-[#232a38] dark:text-[#b9c6e4]",
  reprinted: "bg-warning-bg text-warning-ink",
  unprinted: "bg-danger-bg text-danger-ink",
};

export function KindBadge({ kind }: { kind: AuditKind }) {
  const Icon = KIND_ICON[kind] ?? CircleDot;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-bold whitespace-nowrap", KIND_COLOUR[kind])}>
      <Icon className="size-3.5" />
      {KIND_LABEL[kind]}
    </span>
  );
}

/** One sheet's story, oldest at the top, with the loading time and sending delay between the steps. */
export function SheetTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const Icon = KIND_ICON[s.kind];
        const last = i === steps.length - 1;
        return (
          <li key={`${s.kind}-${s.at}-${i}`} className="relative flex flex-col">
            {s.gap ? (
              <div className="flex items-center gap-3 py-0.5 pl-[3px]">
                <span aria-hidden className="w-6 flex-none" />
                <span className={cn("text-xs font-bold", s.gap.warn ? "text-warning" : "text-muted")}>{s.gap.label}</span>
              </div>
            ) : null}
            <div className="flex gap-3">
              <div className="relative flex w-[30px] flex-none justify-center">
                {!last ? <span aria-hidden className="absolute top-7 bottom-[-4px] w-px bg-line" /> : null}
                <span className={cn("relative grid size-7 place-items-center rounded-full", KIND_COLOUR[s.kind])}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col pb-3">
                <span className="text-sm leading-7 font-bold">
                  {KIND_LABEL[s.kind]} <span className="font-medium text-muted">· {s.actorName || "—"}</span>
                </span>
                <span className="-mt-1 text-xs font-medium text-faint">
                  {formatDateTime(s.at)}
                  {s.kind === "started" || s.kind === "signed" ? " · phone clock" : ""}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
