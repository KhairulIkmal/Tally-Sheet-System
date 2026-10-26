"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count: number;
  icon?: LucideIcon;
  /** Colour of the dot or icon in the menu, e.g. "text-lorry". */
  tone?: string;
}

/**
 * "Status: All ▾": a chip that opens a short list to pick one value. It is
 * coloured while it filters (anything but the first option, "All"), with a ✕
 * to go back to All.
 */
export function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
  activeClass = "border-primary bg-primary-soft text-primary",
}: {
  label: string;
  value: T;
  /** The first option is the "All" one. */
  options: ChipOption<T>[];
  onChange: (value: T) => void;
  /** Chip colours while it filters. */
  activeClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const all = options[0].value;
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== all;

  useEffect(() => {
    if (!open) return;
    // Keyboard users land on the picked option.
    listRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: T) {
    setOpen(false);
    if (v !== value) onChange(v);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  const Icon = current.icon;

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          "flex h-11 items-center rounded-full border-[1.5px] text-[15px] transition-colors",
          active ? activeClass : "border-field bg-surface text-ink hover:border-muted",
          open && !active && "border-muted",
        )}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn("flex h-full items-center gap-1.5 rounded-full pl-4 font-bold", active ? "pr-1.5" : "pr-3")}
        >
          <span className={cn("font-semibold", active ? "opacity-75" : "text-muted")}>{label}:</span>
          {Icon ? <Icon aria-hidden className="size-4" strokeWidth={2.3} /> : null}
          {current.label}
          <ChevronDown aria-hidden className={cn("size-4 opacity-60 transition-transform", open && "rotate-180")} />
        </button>
        {active ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()} filter`}
            onClick={() => pick(all)}
            className="mr-1.5 grid size-7 place-items-center rounded-full hover:bg-black/5"
          >
            <X aria-hidden className="size-4" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          ref={listRef}
          role="menu"
          aria-label={label}
          onKeyDown={onListKey}
          className="absolute top-[calc(100%+6px)] left-0 z-40 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgba(16,24,40,.18)]"
        >
          {options.map((o, i) => {
            const on = o.value === value;
            const OIcon = o.icon;
            return (
              <div key={o.value}>
                {i === 1 ? <div className="mx-2 my-1 h-px bg-line-soft" /> : null}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] font-semibold outline-none hover:bg-canvas focus-visible:bg-canvas",
                    on && "bg-primary-soft/60 hover:bg-primary-soft focus-visible:bg-primary-soft",
                  )}
                >
                  {OIcon ? (
                    <OIcon aria-hidden className={cn("size-4 flex-none", o.tone ?? "text-muted")} strokeWidth={2.3} />
                  ) : (
                    <span aria-hidden className={cn("size-2 flex-none rounded-full bg-current", o.tone ?? "text-faint")} />
                  )}
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="min-w-6 text-right text-sm font-bold text-muted tabular-nums">{o.count}</span>
                  <Check aria-hidden className={cn("size-4 flex-none text-primary", !on && "invisible")} strokeWidth={3} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
