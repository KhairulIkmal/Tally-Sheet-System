"use client";

import { Check } from "lucide-react";
import { Button } from "../ui";

export function SuccessScreen({
  offline,
  reference,
  summary,
  onNew,
  onHome,
}: {
  offline: boolean;
  reference: string;
  summary: string;
  onNew: () => void;
  onHome: () => void;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center gap-[18px] p-6">
        {offline ? (
          <>
            <div className="grid size-[88px] place-items-center rounded-full border-[3px] border-warning bg-warning-bg">
              <span className="size-[30px] animate-spin rounded-full border-4 border-warning border-t-transparent" />
            </div>
            <div className="text-[30px]/[1.15] font-extrabold">Saved on this phone, will send when online</div>
            <div className="text-base/[1.45] font-medium text-body">Don&apos;t clear the browser data. This sheet uploads by itself when there is a connection.</div>
          </>
        ) : (
          <>
            <div className="grid size-[88px] place-items-center rounded-full bg-success text-white">
              <Check className="size-12" strokeWidth={3} />
            </div>
            <div className="text-[32px]/[1.1] font-extrabold">Tally sheet submitted</div>
            <div className="text-base/[1.45] font-medium text-body">The office can view and print it now.</div>
          </>
        )}
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-4">
          <span className="text-[13px] font-bold tracking-[.06em] text-muted">REFERENCE NO</span>
          <span className="font-mono text-[28px] font-semibold">{reference}</span>
          <span className="text-sm font-medium text-muted">{summary}</span>
        </div>
      </div>
      <div className="flex flex-none flex-col gap-2.5 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button onClick={onNew}>+ New tally sheet</Button>
        <Button variant="secondary" className="text-[17px]" onClick={onHome}>
          Back to list
        </Button>
      </div>
    </>
  );
}
