"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/office", label: "Sheets", match: (p: string) => p === "/office" || p.startsWith("/office/sheets") },
  { href: "/office/items", label: "Item history", match: (p: string) => p.startsWith("/office/items") },
];

export function OfficeNav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full gap-6">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-full items-center border-b-[3px] text-[15px]", active ? "border-[#6f9cff] font-semibold" : "border-transparent font-medium opacity-60 hover:opacity-100")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
