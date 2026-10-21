"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isCrossDomainSsoTopology } from "@/lib/supabase/cookieOptions";
import { safeReturnTo } from "@/lib/return-to";
import { CENTRAL_PORTAL_HOME_URL, CENTRAL_PORTAL_LOGIN_URL } from "./central-portal";
import { DEMO_COOKIE, type DemoPersona } from "./dal";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const signInSchema = z.object({
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  returnTo: z.string().nullable().optional(),
});

/**
 * Local development sign-in against the shared Supabase Auth project (the
 * same account as the Portal). In production the Portal signs people in
 * and this form isn't shown.
 */
export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "invalid_credentials") return { ok: false, error: "Incorrect email or password." };
    return { ok: false, error: "Couldn't sign you in. Please try again." };
  }

  redirect(safeReturnTo(parsed.data.returnTo) ?? "/");
}

/** Demo mode only: pick which demo user to be. */
export async function demoSignIn(persona: DemoPersona): Promise<void> {
  if (!isDemoMode()) redirect("/login");
  if (persona !== "worker" && persona !== "office" && persona !== "both") redirect("/login");
  (await cookies()).set(DEMO_COOKIE, persona, { path: "/", sameSite: "lax", httpOnly: true });
  redirect("/");
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) {
    (await cookies()).delete(DEMO_COOKIE);
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(isCrossDomainSsoTopology() ? CENTRAL_PORTAL_HOME_URL : "/login");
}

/** "Use another account" on the sign-in page: sign out, then straight to the Portal sign-in. */
export async function switchAccount(): Promise<void> {
  if (isDemoMode()) {
    (await cookies()).delete(DEMO_COOKIE);
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(isCrossDomainSsoTopology() ? CENTRAL_PORTAL_LOGIN_URL : "/login");
}
