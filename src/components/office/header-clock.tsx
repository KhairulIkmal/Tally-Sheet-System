"use client";

import { useSyncExternalStore } from "react";

const TZ = "Asia/Kuala_Lumpur";
const timeFmt = new Intl.DateTimeFormat("en-MY", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });

function subscribe(tick: () => void) {
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}

/** Malaysia time and date for the office header. Rendered after mount so server and browser never disagree. */
export function HeaderClock() {
  const sec = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
  const now = sec === null ? null : new Date(sec * 1000);

  return (
    <div className="flex min-w-[148px] flex-col items-end leading-tight" aria-live="off">
      <time dateTime={now?.toISOString()} className="font-mono text-[15px] font-semibold tabular-nums tracking-tight">
        {now ? timeFmt.format(now).toUpperCase() : " "}
      </time>
      <span className="text-xs font-medium text-white/55">{now ? dateFmt.format(now) : " "}</span>
    </div>
  );
}
