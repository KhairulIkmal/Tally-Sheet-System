"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSheetsHref } from "./sheets-return";

const LINKS = [
  { href: "/office", label: "Sheets", match: (p: string) => p === "/office" || p.startsWith("/office/sheets") },
  { href: "/office/items", label: "Item history", match: (p: string) => p.startsWith("/office/items") },
];

/**
 * The office tabs. One underline slides to the active tab, and moves on the
 * click itself rather than when the next page arrives; hovering a tab lifts
 * it on a soft pill.
 */
export function OfficeNav() {
  const pathname = usePathname();
  const sheetsHref = useSheetsHref();
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  // A click only counts until the page it started from changes.
  const target = clicked && clicked.from === pathname ? clicked.href : null;
  const active = target ? LINKS.findIndex((l) => l.href === target) : LINKS.findIndex((l) => l.match(pathname));

  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const bar = barRef.current;
    if (!nav || !bar) return;
    const place = () => {
      const el = linkRefs.current[active];
      if (!el) {
        bar.style.opacity = "0";
        return;
      }
      bar.style.opacity = "1";
      bar.style.width = `${el.offsetWidth - 24}px`;
      bar.style.transform = `translateX(${el.offsetLeft + 12}px)`;
    };
    place();
    // Slide only after the first placement, so the bar doesn't fly in on page load.
    const raf = requestAnimationFrame(() => bar.setAttribute("data-ready", ""));
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active]);

  return (
    <nav ref={navRef} className="relative flex h-full items-center gap-1">
      {LINKS.map((l, i) => {
        const on = i === active;
        return (
          <Link
            key={l.href}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            href={l.href === "/office" ? sheetsHref : l.href}
            aria-current={on ? "page" : undefined}
            onClick={() => setClicked({ href: l.href, from: pathname })}
            className={cn(
              "group relative flex h-full items-center px-3 text-[15px] transition-colors duration-200",
              on ? "font-semibold text-white" : "font-medium text-white/60 hover:text-white",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0.5 top-1/2 h-9 -translate-y-1/2 scale-90 rounded-lg bg-white/[.08] opacity-0 transition duration-200 ease-out",
                "group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none",
                on && "group-hover:opacity-60",
              )}
            />
            <span className="relative transition-transform duration-200 ease-out group-active:scale-95 motion-reduce:transition-none">
              {l.label}
            </span>
          </Link>
        );
      })}
      <span
        ref={barRef}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-t-full bg-[#6f9cff] opacity-0 shadow-[0_0_12px_rgba(111,156,255,.7)] data-[ready]:transition-[transform,width,opacity] data-[ready]:duration-300 data-[ready]:ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
      />
    </nav>
  );
}
