"use client";

import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickState, ProductOption } from "../pick";
import { BottomBar, Button, Scroll, SectionLabel, TextField } from "../ui";

function ProductRow({ p, selected, onPick }: { p: ProductOption; selected: boolean; onPick: () => void }) {
  const meta = [p.sku ? `SKU ${p.sku}` : null, p.ctnPerPallet ? `${p.ctnPerPallet} CTN/plt` : null].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn("flex min-h-16 w-full items-center gap-3 border-b border-line-soft px-4 py-2 text-left", selected ? "bg-primary-soft" : "bg-surface")}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-bold">{p.name}</div>
        {meta ? <div className="text-[13px] font-medium text-muted">{meta}</div> : null}
      </div>
      <span
        className={cn(
          "size-7 flex-none rounded-full border-2",
          selected ? "border-primary bg-primary shadow-[inset_0_0_0_4px_var(--color-surface)]" : "border-placeholder bg-surface",
        )}
      />
    </button>
  );
}

export function ProductPickerScreen({
  pick,
  products,
  recent,
  onSearch,
  onPick,
  onCustom,
  onName,
  onNext,
}: {
  pick: PickState;
  products: ProductOption[];
  recent: string[];
  onSearch: (q: string) => void;
  onPick: (p: ProductOption) => void;
  onCustom: () => void;
  onName: (name: string) => void;
  onNext: () => void;
}) {
  const q = pick.q.trim().toLowerCase();
  const match = (p: ProductOption) => !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
  const recentList = recent.map((n) => products.find((p) => p.name === n)).filter((p): p is ProductOption => !!p).filter(match);
  const list = products.filter(match);
  const canNext = pick.name.trim().length > 0;

  return (
    <>
      <div className="flex-none border-b border-line bg-surface px-4 pt-2.5 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" />
          <TextField
            value={pick.q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="rounded-xl bg-canvas pl-11 text-lg focus:bg-surface"
          />
        </div>
      </div>
      <Scroll>
        {recentList.length > 0 ? <SectionLabel className="px-4 pt-3.5 pb-1.5">Recently used</SectionLabel> : null}
        {recentList.map((p) => (
          <ProductRow key={`r-${p.id}`} p={p} selected={pick.productId === p.id} onPick={() => onPick(p)} />
        ))}
        <SectionLabel className="px-4 pt-4 pb-1.5">{q ? `Product list · ${list.length} match${list.length === 1 ? "" : "es"}` : "All products"}</SectionLabel>
        {list.map((p) => (
          <ProductRow key={p.id} p={p} selected={pick.productId === p.id} onPick={() => onPick(p)} />
        ))}
        {products.length === 0 ? (
          <div className="px-4 py-3 text-sm font-medium text-muted">The product list is empty. Type the item name yourself below.</div>
        ) : null}
        <button
          type="button"
          onClick={onCustom}
          className="mx-4 mt-3.5 mb-4 flex min-h-[60px] flex-none items-center gap-3 rounded-xl border-[1.5px] border-dashed border-placeholder px-3.5 py-2.5 text-left"
        >
          <Plus className="size-6 text-primary" />
          <div>
            <div className="text-base font-bold">Use my own name</div>
            <div className="text-[13px] font-medium text-muted">
              {q ? `"${pick.q}" not in the list? Use this name.` : "Type an item name that isn't in the list"}
            </div>
          </div>
        </button>
      </Scroll>
      <BottomBar className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-bold text-muted">Item name (editable)</span>
          <TextField
            value={pick.name}
            onChange={(e) => onName(e.target.value.toUpperCase())}
            placeholder="Pick a product or type"
            upper
            className="h-[52px] text-[17px]"
          />
        </label>
        <Button className="w-full" disabled={!canNext} onClick={onNext}>
          Next · Pallets
        </Button>
      </BottomBar>
    </>
  );
}
