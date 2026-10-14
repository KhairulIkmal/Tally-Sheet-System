import { CHECKS } from "@/lib/tally/constants";
import type { Draft } from "@/lib/tally/draft";
import type { SubmitPayload } from "@/lib/tally/payload";

/**
 * On-device storage for the worker app. Everything is keyed by user id so
 * two people sharing a tablet never see each other's drafts. Every access
 * is wrapped: storage can be full, blocked or unavailable.
 */

export interface OutboxEntry {
  clientId: string;
  payload: SubmitPayload;
  /** For the home list while it waits. */
  vehicleNo: string;
  docNo: string;
  pallets: number;
  ctn: number;
  queuedAt: string;
  state: "pending" | "failed";
  error?: string;
}

const draftKey = (userId: string) => `tally:draft:${userId}`;
const outboxKey = (userId: string) => `tally:outbox:${userId}`;
type RecentKind = "products" | "transfer";
const recentKey = (userId: string, kind: RecentKind) => `tally:recent-${kind}:${userId}`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(userId: string): Draft | null {
  const d = read<Draft>(draftKey(userId));
  if (!(d && typeof d === "object" && Array.isArray(d.items) && d.header)) return null;
  // Drafts saved before the lorry boxes took a CTN count stored { on, note }.
  for (const k of CHECKS) {
    const c = (d.checks?.[k] ?? {}) as Partial<{ qty: number; note: string }>;
    d.checks = { ...d.checks, [k]: { qty: Number(c.qty) || 0, note: typeof c.note === "string" ? c.note : "" } };
  }
  return d;
}

export function saveDraft(userId: string, draft: Draft | null): boolean {
  return write(draftKey(userId), draft);
}

export function loadOutbox(userId: string): OutboxEntry[] {
  const list = read<OutboxEntry[]>(outboxKey(userId));
  return Array.isArray(list) ? list : [];
}

export function saveOutbox(userId: string, list: OutboxEntry[]): boolean {
  return write(outboxKey(userId), list.length ? list : null);
}

/** Recently used product names / Transfer To values, newest first. */
export function loadRecent(userId: string, kind: RecentKind): string[] {
  const list = read<string[]>(recentKey(userId, kind));
  return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, 5) : [];
}

export function remember(userId: string, kind: RecentKind, value: string): string[] {
  const v = value.trim();
  if (!v) return loadRecent(userId, kind);
  const list = [v, ...loadRecent(userId, kind).filter((n) => n !== v)].slice(0, 5);
  write(recentKey(userId, kind), list);
  return list;
}

/** A short description of this device for the office ("Android · Chrome 129"). */
export function describeDevice(): string {
  try {
    const ua = navigator.userAgent;
    const os = /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Mac OS/i.test(ua)
            ? "macOS"
            : "Device";
    const model = /Android[^;]*;\s*([^;)]+)/.exec(ua)?.[1]?.trim();
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
    return [os, model && model !== "K" ? model : null, browser].filter(Boolean).join(" · ").slice(0, 160);
  } catch {
    return "Unknown device";
  }
}
