import type { Metadata } from "next";
import { readAsOffice } from "@/lib/auth/dal";
import {
  addDays,
  addMonths,
  countByDay,
  dayStart,
  klDay,
  parseFilter,
  parseMonth,
  rangeBounds,
} from "@/lib/data/filters";
import { AUDIT_MAX_DAYS } from "@/lib/tally/audit";
import { AuditView } from "@/components/office/audit-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const today = klDay(new Date());
  // Same days as the sheets list (the last 7 by default), never more than AUDIT_MAX_DAYS.
  let { from, to } = parseFilter({ from: one("from"), to: one("to") });
  from ??= addDays(today, -6);
  to ??= today;
  if (from < addDays(to, -(AUDIT_MAX_DAYS - 1)))
    from = addDays(to, -(AUDIT_MAX_DAYS - 1));
  const { since, until } = rangeBounds({ from, to })!;

  const month = parseMonth(params.month, to);

  const [, [data, submittedAt]] = await readAsOffice((store) =>
    Promise.all([
      store.listAudit(since, until),
      store.listSubmittedAt(
        dayStart(`${month}-01`),
        dayStart(`${addMonths(month, 1)}-01`),
      ),
    ]),
  );
  const tab = one("tab");
  return (
    <AuditView
      data={data}
      from={from}
      to={to}
      today={today}
      month={month}
      dayCounts={countByDay(submittedAt)}
      since={since}
      until={until}
      initialTab={tab === "attention" || tab === "daily" ? tab : "log"}
      initialQuery={(one("q") ?? "").slice(0, 60)}
    />
  );
}
