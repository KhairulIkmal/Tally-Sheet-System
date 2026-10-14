"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveProductAction } from "@/lib/data/actions";
import type { Product } from "@/lib/data/types";

interface Editing {
  id: string | null;
  name: string;
  sku: string;
  per: string;
  isActive: boolean;
}

const blank: Editing = { id: null, name: "", sku: "", per: "", isActive: true };

/** Office: the product list workers pick from. Products are deactivated, never deleted, so old sheets keep their link. */
export function ProductManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();

  const shown = products.filter((p) => !q.trim() || `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    const per = editing.per.trim() ? parseInt(editing.per, 10) : null;
    startTransition(async () => {
      const res = await saveProductAction({
        id: editing.id,
        name: editing.name.trim().toUpperCase(),
        sku: editing.sku.trim().toUpperCase() || null,
        ctnPerPallet: per,
        isActive: editing.isActive,
      });
      if (!res.ok) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }

  const input = "h-11 rounded-lg border-[1.5px] border-field bg-surface px-3 text-[15px] font-semibold uppercase outline-none focus:border-primary";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <h1 className="text-[28px] font-extrabold">Products</h1>
            <div className="text-[15px] font-medium text-muted">The list workers pick items from. They can still type a name that isn&apos;t here.</div>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="h-11 w-[260px] rounded-lg border border-field bg-surface px-3.5 text-[15px] font-medium outline-none focus:border-primary" />
          <button
            type="button"
            onClick={() => {
              setError("");
              setEditing(blank);
            }}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-[15px] font-bold text-white"
          >
            <Plus className="size-5" /> Add product
          </button>
        </div>

        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-surface p-4">
            <div className="text-lg font-bold">{editing.id ? "Edit product" : "New product"}</div>
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">Name</span>
                <input autoFocus required maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">SKU (optional)</span>
                <input maxLength={30} value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-body">CTN per pallet</span>
                <input inputMode="numeric" value={editing.per} onChange={(e) => setEditing({ ...editing, per: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={input} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-[15px] font-semibold">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-5" />
              Active (shown to workers)
            </label>
            {error ? <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-ink">{error}</div> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="h-11 rounded-lg bg-primary px-5 font-bold text-white disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-lg border-[1.5px] border-field px-5 font-bold">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="grid h-11 grid-cols-[1fr_140px_140px_110px_80px] items-center border-b border-line bg-surface-sunken px-4 text-xs font-bold tracking-[.06em] text-muted">
            <span>NAME</span>
            <span>SKU</span>
            <span className="text-right">CTN / PALLET</span>
            <span className="pl-6">STATUS</span>
            <span />
          </div>
          {shown.map((p) => (
            <div key={p.id} className={cn("grid h-[50px] grid-cols-[1fr_140px_140px_110px_80px] items-center border-b border-line-soft px-4 text-[15px] font-medium", !p.isActive && "text-faint")}>
              <span className="truncate font-semibold">{p.name}</span>
              <span>{p.sku ?? "—"}</span>
              <span className="text-right">{p.ctnPerPallet ?? "—"}</span>
              <span className="pl-6">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", p.isActive ? "bg-success-bg text-success" : "bg-chip text-muted")}>{p.isActive ? "Active" : "Hidden"}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setEditing({ id: p.id, name: p.name, sku: p.sku ?? "", per: p.ctnPerPallet ? String(p.ctnPerPallet) : "", isActive: p.isActive });
                }}
                className="text-right text-sm font-bold text-primary"
              >
                Edit
              </button>
            </div>
          ))}
          {shown.length === 0 ? <div className="px-4 py-10 text-center text-[15px] font-medium text-muted">{products.length ? "No matching products." : "No products yet. Add the items workers count most often."}</div> : null}
        </div>
      </div>
    </div>
  );
}
