import type { Metadata } from "next";
import { requireOffice, storeFor } from "@/lib/auth/dal";
import { parseFilter } from "@/lib/data/filters";
import { SheetsList } from "@/components/office/sheets-list";

export const metadata: Metadata = { title: "Submitted sheets" };

export default async function OfficeSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOffice();
  const filter = parseFilter(await searchParams);
  const sheets = await storeFor(user).listSheets(filter, 300);
  return <SheetsList sheets={sheets} filter={filter} />;
}
