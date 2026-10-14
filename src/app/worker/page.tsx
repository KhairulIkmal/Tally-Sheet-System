import type { Metadata } from "next";
import { hasRole, requireWorker, storeFor } from "@/lib/auth/dal";
import { WorkerApp } from "@/components/worker/worker-app";

export const metadata: Metadata = { title: "Worker" };

export default async function WorkerPage() {
  const user = await requireWorker();
  const store = storeFor(user);
  const [products, sheets] = await Promise.all([store.listProducts(false), store.listMySheets(user.id, 30)]);
  return (
    <WorkerApp
      user={{ id: user.id, name: user.name, department: user.department, initials: user.initials, isOffice: hasRole(user, "office") }}
      products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, ctnPerPallet: p.ctnPerPallet }))}
      sheets={sheets}
    />
  );
}
