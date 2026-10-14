import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOffice, storeFor } from "@/lib/auth/dal";
import { SheetDetailView } from "@/components/office/sheet-detail";

export const metadata: Metadata = { title: "Sheet" };

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOffice();
  const { id } = await params;
  const sheet = await storeFor(user).getSheet(id);
  if (!sheet) notFound();
  return <SheetDetailView sheet={sheet} />;
}
