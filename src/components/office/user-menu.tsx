"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, LogOut, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/actions";
import { CENTRAL_PORTAL_HOME_URL } from "@/lib/auth/central-portal";

/** The signed-in person in the office header: avatar, name and role, with Sign out in the menu. */
export function UserMenu({
  name,
  email,
  initials,
  roleLabel,
  department,
  canOpenWorker,
}: {
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
  department: string;
  canOpenWorker: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  const item = "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-body hover:bg-canvas";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("flex h-11 items-center gap-2.5 rounded-xl py-1 pr-2.5 pl-1.5 hover:bg-white/10", open && "bg-white/10")}
      >
        <span className="grid size-9 place-items-center rounded-full bg-[#6f9cff] text-sm font-extrabold text-[#0b1730]">{initials}</span>
        <span className="flex max-w-[240px] flex-col items-start leading-tight">
          <span className="w-full truncate text-left text-sm font-bold">{name}</span>
          <span className="text-xs font-medium text-white/55">{roleLabel}</span>
        </span>
        <ChevronDown className={cn("size-4 text-white/60 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-[310px] rounded-2xl border border-line bg-surface p-2 text-ink shadow-[0_20px_50px_rgba(16,24,40,.22)]"
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <span className="grid size-11 flex-none place-items-center rounded-full bg-primary-soft text-base font-extrabold text-primary">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="text-[15px]/tight font-extrabold">{name}</div>
              <div className="truncate text-xs font-medium text-muted">{email}</div>
              <div className="truncate text-xs font-medium text-muted">
                {roleLabel} · {department}
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-line-soft" />
          {canOpenWorker ? (
            <Link role="menuitem" href="/worker" className={item} onClick={() => setOpen(false)}>
              <Smartphone className="size-4 text-muted" /> Open worker app
            </Link>
          ) : null}
          <a role="menuitem" href={CENTRAL_PORTAL_HOME_URL} className={item}>
            <ExternalLink className="size-4 text-muted" /> Lam Soon PSG Portal
          </a>
          <div className="my-1 h-px bg-line-soft" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className={cn(item, "text-danger hover:bg-danger-bg")}>
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
