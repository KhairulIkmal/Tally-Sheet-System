import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorker, storeFor } from "@/lib/auth/dal";
import { SubmittedSheetView } from "@/components/worker/submitted-sheet";

export const metadata: Metadata = { title: "Sheet" };

export default async function WorkerSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWorker();
  const { id } = await params;
  // RLS (and the demo store) only return the worker's own sheets.
  const sheet = await storeFor(user).getSheet(id);
  if (!sheet || sheet.preparedBy !== user.id) notFound();
  return <SubmittedSheetView sheet={sheet} />;
}
