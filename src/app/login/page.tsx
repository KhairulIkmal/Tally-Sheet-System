import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth/dal";
import { isDemoMode } from "@/lib/env";
import { isCrossDomainSsoTopology } from "@/lib/supabase/cookieOptions";
import { CENTRAL_PORTAL_LOGIN_URL } from "@/lib/auth/central-portal";
import { LamSoonLogo } from "@/components/brand";
import { LoginForm } from "./login-form";
import { DemoPicker } from "./demo-picker";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const demo = isDemoMode();
  // Production: the Portal owns sign-in.
  if (!demo && isCrossDomainSsoTopology()) redirect(CENTRAL_PORTAL_LOGIN_URL);
  const { returnTo } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,24,40,.05)]">
        <LamSoonLogo className="mb-4 h-14 w-auto" />
        <div className="mb-1 text-[26px] font-extrabold">Tally Sheet</div>
        <div className="mb-6 text-[15px] font-medium text-muted">Lam Soon warehouse · Count Tally Sheet</div>
        {demo ? <DemoPicker /> : <LoginForm returnTo={returnTo} />}
      </div>
    </main>
  );
}
