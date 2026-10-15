import type { Metadata } from "next";
import { hasRole, requireWorker, storeFor } from "@/lib/auth/dal";
import { WorkerApp } from "@/components/worker/worker-app";

export const metadata: Metadata = { title: "Worker" };

export default async function WorkerPage() {
  const user = await requireWorker();
  const store = storeFor(user);
  const [history, sheets] = await Promise.all([store.listItemHistory(false), store.listMySheets(user.id, 30)]);
  return (
    <WorkerApp
      user={{ id: user.id, name: user.name, department: user.department, initials: user.initials, isOffice: hasRole(user, "office") }}
      history={history.map((h) => ({ name: h.name, unit: h.unit, qtyPerPallet: h.qtyPerPallet, useCount: h.useCount }))}
      sheets={sheets}
    />
  );
}
