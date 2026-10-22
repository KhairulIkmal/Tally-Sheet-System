import type { Metadata } from "next";
import { readAsOffice } from "@/lib/auth/dal";
import { ItemHistoryManager } from "@/components/office/item-history-manager";

export const metadata: Metadata = { title: "Item history" };

export default async function ItemHistoryPage() {
  const [, items] = await readAsOffice((store) => store.listItemHistory(true));
  return <ItemHistoryManager items={items} />;
}
