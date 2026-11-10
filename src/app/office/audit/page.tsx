import type { Metadata } from "next";
import { readAsOffice } from "@/lib/auth/dal";
import { addDays, klDay, parseFilter, rangeBounds } from "@/lib/data/filters";
import { AUDIT_MAX_DAYS } from "@/lib/tally/audit";
import { AuditView } from "@/components/office/audit-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  if (from < addDays(to, -(AUDIT_MAX_DAYS - 1))) from = addDays(to, -(AUDIT_MAX_DAYS - 1));
  const { since, until } = rangeBounds({ from, to })!;

  const [, data] = await readAsOffice((store) => store.listAudit(since, until));
  const tab = one("tab");
  return (
    <AuditView
      data={data}
      from={from}
      to={to}
      today={today}
      since={since}
      until={until}
      initialTab={tab === "attention" || tab === "daily" ? tab : "log"}
      initialQuery={(one("q") ?? "").slice(0, 60)}
    />
  );
}
