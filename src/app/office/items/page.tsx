import type { Metadata } from "next";
import { requireOffice, storeFor } from "@/lib/auth/dal";
import { ItemHistoryManager } from "@/components/office/item-history-manager";

export const metadata: Metadata = { title: "Item history" };

export default async function ItemHistoryPage() {
  const user = await requireOffice();
  const items = await storeFor(user).listItemHistory(true);
  return <ItemHistoryManager items={items} />;
}
