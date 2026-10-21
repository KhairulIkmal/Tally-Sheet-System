import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USERS } from "@/lib/data/demo-store";
import { demoStore } from "@/lib/data/demo-store";
import { supabaseStore } from "@/lib/data/supabase-store";
import type { TallyStore } from "@/lib/data/types";

export type TallyRole = "worker" | "office";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  department: string;
  roles: TallyRole[];
  initials: string;
}

export type DeniedReason = "no_access" | "pending" | "suspended" | "revoked" | "inactive" | "no_role";

export type SessionOutcome =
  | { status: "signed_out" }
  | { status: "denied"; reason: DeniedReason; name: string; email: string }
  | { status: "ok"; user: CurrentUser };

export const DEMO_COOKIE = "tally_demo_user";
export type DemoPersona = "worker" | "office" | "both";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function loadDemoSession(): Promise<SessionOutcome> {
  const persona = (await cookies()).get(DEMO_COOKIE)?.value as DemoPersona | undefined;
  if (persona !== "worker" && persona !== "office" && persona !== "both") return { status: "signed_out" };
  const base = persona === "office" ? DEMO_USERS.office : DEMO_USERS.worker;
  const roles: TallyRole[] = persona === "both" ? ["worker", "office"] : [persona];
  return {
    status: "ok",
    user: { id: base.id, name: base.name, email: base.email, department: "Logistics (demo)", roles, initials: initialsOf(base.name) },
  };
}

/**
 * Reads the shared Supabase session and turns it into an app-level
 * outcome, once per render pass. This is a convenience gate; the tally.*
 * RLS policies and RPCs re-check every read and write on their own.
 */
const loadSession = cache(async (): Promise<SessionOutcome> => {
  if (isDemoMode()) return loadDemoSession();

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) return { status: "signed_out" };
  const userId = claims.claims.sub;

  const { data: me } = await supabase.rpc("me");
  if (me && Array.isArray(me.roles) && me.roles.length > 0) {
    const name: string = me.name ?? "";
    return {
      status: "ok",
      user: {
        id: me.userId,
        name,
        email: me.email ?? "",
        department: me.department ?? "Unassigned",
        roles: (me.roles as string[]).filter((r): r is TallyRole => r === "worker" || r === "office"),
        initials: initialsOf(name || "?"),
      },
    };
  }

  // Not authorized — work out why, from the caller's own rows only.
  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase.schema("public").from("profiles").select("full_name, company_email, account_status").eq("id", userId).maybeSingle(),
    supabase
      .schema("public")
      .from("user_system_access")
      .select("status, systems!inner(slug)")
      .eq("user_id", userId)
      .eq("systems.slug", "tally_sheet")
      .maybeSingle(),
  ]);
  if (!profile) return { status: "signed_out" };
  const who = { name: profile.full_name ?? "", email: profile.company_email ?? "" };
  if (profile.account_status !== "active") return { status: "denied", reason: "inactive", ...who };
  if (!access) return { status: "denied", reason: "no_access", ...who };
  if (access.status === "pending" || access.status === "suspended" || access.status === "revoked") {
    return { status: "denied", reason: access.status, ...who };
  }
  return { status: "denied", reason: "no_role", ...who };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const outcome = await loadSession();
  return outcome.status === "ok" ? outcome.user : null;
}

/** The whole outcome, for the sign-in page: signed out, denied (and why), or signed in. */
export async function getSessionOutcome(): Promise<SessionOutcome> {
  return loadSession();
}

export async function getDeniedState(): Promise<{ reason: DeniedReason; name: string; email: string } | null> {
  const outcome = await loadSession();
  return outcome.status === "denied" ? outcome : null;
}

export function hasRole(user: CurrentUser | null | undefined, role: TallyRole): boolean {
  return !!user?.roles.includes(role);
}

/** Guard for every page and action: a signed-in user with at least one Tally Sheet role. */
export async function requireUser(): Promise<CurrentUser> {
  const outcome = await loadSession();
  if (outcome.status === "ok") return outcome.user;
  if (outcome.status === "signed_out") {
    // Our own sign-in page first, like the other Lam Soon systems; its button goes on to the Portal.
    redirect("/login");
  }
  redirect(`/access-denied?reason=${outcome.reason}`);
}

export async function requireWorker(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, "worker")) redirect("/access-denied?reason=worker_only");
  return user;
}

export async function requireOffice(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, "office")) redirect("/access-denied?reason=office_only");
  return user;
}

/** The data store acting as this user. */
export function storeFor(user: CurrentUser): TallyStore {
  return isDemoMode() ? demoStore(user) : supabaseStore();
}

/** Where a user lands after sign-in: the office list for office staff, otherwise the worker app. */
export function homePathFor(user: CurrentUser): string {
  return hasRole(user, "office") && !hasRole(user, "worker") ? "/office" : hasRole(user, "worker") ? "/worker" : "/office";
}
