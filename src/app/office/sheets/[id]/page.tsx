import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readAsOffice } from "@/lib/auth/dal";
import { SheetDetailView } from "@/components/office/sheet-detail";

export const metadata: Metadata = { title: "Sheet" };

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, sheet] = await readAsOffice((store) => store.getSheet(id));
  if (!sheet) notFound();
  return <SheetDetailView sheet={sheet} />;
}
