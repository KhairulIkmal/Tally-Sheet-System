"use client";

import { useSyncExternalStore } from "react";

const KEY = "tally:office-list-query";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The list keeps its filters in the URL; this remembers them for this tab, for the way back. */
export function rememberSheetsQuery(query: string) {
  try {
    window.sessionStorage.setItem(KEY, query);
  } catch {
    // Storage blocked: the way back opens the default list.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Where "back to the sheets" goes: the list as it was last left in this tab. */
export function useSheetsHref(): string {
  const query = useSyncExternalStore(subscribe, read, () => "");
  return query ? `/office?${query}` : "/office";
}
