"use client";

import { useRouter } from "next/navigation";
import { PaperViewer } from "@/components/paper/paper-viewer";
import { isoToPaperDate } from "@/lib/tally/dates";
import { formatQty } from "@/lib/tally/draft";
import { paperFromSheet, type SheetDetail } from "@/lib/tally/sheet";
import { TopBar } from "./ui";

/** A submitted sheet, read-only, laid out as the printed tally sheet. */
export function SubmittedSheetView({ sheet }: { sheet: SheetDetail }) {
  const router = useRouter();
  return (
    <div className="relative mx-auto flex h-dvh max-w-[820px] flex-col overflow-hidden bg-canvas text-ink">
      <TopBar
        title={sheet.vehicleNo}
        subtitle={`${sheet.ref} · ${isoToPaperDate(sheet.date)}`}
        onBack={() => router.push("/worker")}
        form={sheet.form}
      />
      <div className="flex-none border-t border-line bg-surface px-4 py-2 text-sm font-semibold text-muted">
        {sheet.totalPallets} pallets · {formatQty(sheet.qtyByUnit)} · {sheet.status === "printed" ? "Printed by the office" : "Submitted"}
      </div>
      <PaperViewer data={paperFromSheet(sheet)} />
    </div>
  );
}
