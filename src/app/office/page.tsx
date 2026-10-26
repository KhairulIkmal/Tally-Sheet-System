import type { Metadata } from "next";
import { readAsOffice } from "@/lib/auth/dal";
import { addMonths, countByDay, dayStart, klDay, parseFilter, parseMonth } from "@/lib/data/filters";
import { SheetsList } from "@/components/office/sheets-list";

export const metadata: Metadata = { title: "Submitted sheets" };

export default async function OfficeSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params);
  const today = klDay(new Date());
  const month = parseMonth(params.month, filter.to ?? today);

  // Status and form are filtered here, not in the query, so each chip's menu can show its counts.
  const [, [all, submittedAt]] = await readAsOffice((store) =>
    Promise.all([
      store.listSheets({ ...filter, status: "all", form: "all" }, 300),
      store.listSubmittedAt(dayStart(`${month}-01`), dayStart(`${addMonths(month, 1)}-01`)),
    ]),
  );
  const ofForm = filter.form === "all" ? all : all.filter((s) => s.form === filter.form);
  const ofStatus = filter.status === "all" ? all : all.filter((s) => s.status === filter.status);
  const statusCounts = {
    all: ofForm.length,
    submitted: ofForm.filter((s) => s.status === "submitted").length,
    printed: ofForm.filter((s) => s.status === "printed").length,
  };
  const formCounts = {
    all: ofStatus.length,
    container: ofStatus.filter((s) => s.form === "container").length,
    lorry: ofStatus.filter((s) => s.form === "lorry").length,
  };
  const sheets = filter.status === "all" ? ofForm : ofForm.filter((s) => s.status === filter.status);

  return (
    <SheetsList
      sheets={sheets}
      filter={filter}
      statusCounts={statusCounts}
      formCounts={formCounts}
      month={month}
      today={today}
      dayCounts={countByDay(submittedAt)}
    />
  );
}
