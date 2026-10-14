"use client";

import { Loader2 } from "lucide-react";
import { PaperViewer } from "@/components/paper/paper-viewer";
import type { PaperData } from "@/lib/tally/sheet";
import { BottomBar, Button } from "../ui";

export function PreviewScreen({
  paper,
  summary,
  submitting,
  error,
  onSubmit,
}: {
  paper: PaperData;
  summary: string;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <>
      <PaperViewer data={paper} />
      <BottomBar className="flex flex-col gap-2">
        {error ? (
          <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-ink">
            {error}
          </div>
        ) : null}
        <div className="text-center text-sm font-semibold text-muted">{summary}</div>
        <Button size="lg" className="w-full rounded-[14px] text-xl font-extrabold" disabled={submitting} onClick={onSubmit}>
          {submitting ? <Loader2 className="size-6 animate-spin" /> : null}
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </BottomBar>
    </>
  );
}
