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

  // Status is filtered here, not in the query, so both chips can show their counts.
  const [, [all, submittedAt]] = await readAsOffice((store) =>
    Promise.all([
      store.listSheets({ ...filter, status: "all" }, 300),
      store.listSubmittedAt(dayStart(`${month}-01`), dayStart(`${addMonths(month, 1)}-01`)),
    ]),
  );
  const counts = {
    submitted: all.filter((s) => s.status === "submitted").length,
    printed: all.filter((s) => s.status === "printed").length,
  };
  const sheets = filter.status === "all" ? all : all.filter((s) => s.status === filter.status);

  return (
    <SheetsList
      sheets={sheets}
      filter={filter}
      statusCounts={counts}
      month={month}
      today={today}
      dayCounts={countByDay(submittedAt)}
    />
  );
}
