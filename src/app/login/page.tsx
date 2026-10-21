import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { getSessionOutcome, homePathFor } from "@/lib/auth/dal";
import { switchAccount } from "@/lib/auth/actions";
import { CENTRAL_PORTAL_HOME_URL, CENTRAL_PORTAL_LOGIN_URL } from "@/lib/auth/central-portal";
import { DENIED_COPY } from "@/lib/auth/denied-copy";
import { isDemoMode } from "@/lib/env";
import { safeReturnTo } from "@/lib/return-to";
import { isCrossDomainSsoTopology } from "@/lib/supabase/cookieOptions";
import { LamSoonLogo } from "@/components/brand";
import { LoginForm } from "./login-form";
import { DemoPicker } from "./demo-picker";

export const metadata: Metadata = { title: "Sign in" };

// A few rows of a sheet, as a picture of what the app is: the last pallet of the item circled in red.
const PREVIEW = [
  { plt: 1, name: "36X240G DAISY MARG", qty: 40, last: false },
  { plt: 2, name: "〃", qty: 40, last: false },
  { plt: 3, name: "TOTAL 120", qty: 40, last: true },
] as const;

const primaryBtn =
  "flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-5 text-[17px] font-bold text-white hover:bg-primary-hover";
const secondaryBtn =
  "flex h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-field bg-surface px-5 text-base font-bold text-ink hover:border-primary";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Who({ name, email, detail }: { name: string; email: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-sunken p-3.5">
      <span
        aria-hidden
        className="grid size-12 flex-none place-items-center rounded-full bg-primary-soft text-base font-extrabold text-primary"
      >
        {initialsOf(name || email)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-lg/tight font-extrabold">{name || email}</div>
        <div className="truncate text-sm font-medium text-muted">{detail ? `${detail} · ${email}` : email}</div>
      </div>
    </div>
  );
}

function UseAnotherAccount() {
  return (
    <form action={switchAccount}>
      <button type="submit" className="h-11 w-full rounded-xl text-[15px] font-bold text-primary hover:bg-primary-soft">
        Use another account
      </button>
    </form>
  );
}

async function SignInPanel({ returnTo }: { returnTo?: string }) {
  const demo = isDemoMode();
  if (demo) return <DemoPicker />;
  // Local development without the Portal next door: sign in here with the shared account.
  if (!isCrossDomainSsoTopology()) return <LoginForm returnTo={returnTo} />;

  const outcome = await getSessionOutcome();
  if (outcome.status === "signed_out") {
    return (
      <div className="flex flex-col gap-3.5">
        <a href={CENTRAL_PORTAL_LOGIN_URL} className={primaryBtn}>
          Sign in with Lam Soon account <ArrowRight aria-hidden className="size-5" />
        </a>
        <p className="text-center text-sm font-medium text-muted">Your Lam Soon PSG Portal account. No new password.</p>
      </div>
    );
  }
  if (outcome.status === "ok") {
    const { user } = outcome;
    const roles = user.roles.map((r) => (r === "worker" ? "Worker" : "Office")).join(" · ");
    return (
      <div className="flex flex-col gap-3">
        <Who name={user.name} email={user.email} detail={roles} />
        <Link href={safeReturnTo(returnTo) ?? homePathFor(user)} className={primaryBtn}>
          Continue as {user.name.split(/\s+/).slice(0, 2).join(" ") || "you"} <ArrowRight aria-hidden className="size-5" />
        </Link>
        <UseAnotherAccount />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Who name={outcome.name} email={outcome.email} />
      <div
        role="alert"
        className="flex gap-2.5 rounded-xl border border-danger-border bg-danger-bg p-3.5 text-[15px] font-semibold text-danger-ink"
      >
        <ShieldAlert aria-hidden className="mt-0.5 size-5 flex-none" />
        <p>{DENIED_COPY[outcome.reason] ?? DENIED_COPY.no_access}</p>
      </div>
      <a href={CENTRAL_PORTAL_HOME_URL} className={secondaryBtn}>
        Back to Lam Soon PSG Portal
      </a>
      <UseAnotherAccount />
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  // Outside production a signed-in visit skips straight in; live, "Continue as" confirms the account.
  if (isDemoMode() || !isCrossDomainSsoTopology()) {
    const outcome = await getSessionOutcome();
    if (outcome.status === "ok") redirect(homePathFor(outcome.user));
  }

  return (
    <main className="flex min-h-dvh flex-col bg-surface lg:grid lg:grid-cols-2">
      <section className="relative overflow-hidden bg-primary px-6 pt-9 pb-14 text-white lg:flex lg:flex-col lg:justify-center lg:px-16 lg:py-16">
        {/* Ruled lines, like the paper sheet. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_34px)]"
        />
        <div className="relative mx-auto w-full max-w-[440px]">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-2xl bg-white p-1.5 shadow-[0_6px_20px_rgba(0,0,0,.18)]">
              <LamSoonLogo className="h-full w-auto" />
            </span>
            <div>
              <div className="text-[15px] font-bold">Lam Soon PSG</div>
              <div className="font-condensed text-[13px] font-semibold tracking-[.08em] text-white/70 uppercase">Warehouse</div>
            </div>
          </div>
          <h1 className="text-[44px]/none font-extrabold tracking-tight lg:text-[60px]/none">Tally Sheet</h1>
          <p className="mt-3 max-w-[380px] text-[17px]/snug font-medium text-white/85">
            Count pallets on your phone, sign, and submit. The office prints it, just like the paper sheet.
          </p>

          <div
            aria-hidden
            className="mt-7 rounded-xl bg-white p-3 font-condensed text-ink shadow-[0_10px_30px_rgba(0,0,0,.22)] [@media(max-height:700px)]:hidden"
          >
            <div className="grid grid-cols-[34px_1fr_44px] border-b-2 border-ink pb-1 text-[11px] font-bold tracking-[.06em] text-muted uppercase">
              <span>Plt</span>
              <span>Item</span>
              <span className="text-right">Qty</span>
            </div>
            {PREVIEW.map((r) => (
              <div
                key={r.plt}
                className="grid grid-cols-[34px_1fr_44px] items-center border-b border-line py-1.5 text-[15px] font-bold last:border-0"
              >
                <span className="text-muted">{r.plt}</span>
                <span className={r.last ? "text-danger" : r.name === "〃" ? "text-faint" : ""}>{r.name}</span>
                <span className="flex justify-end">
                  <span
                    className={
                      r.last
                        ? "grid size-8 place-items-center rounded-full border-2 border-danger text-danger"
                        : "grid size-8 place-items-center"
                    }
                  >
                    {r.qty}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-surface px-6 pt-8 pb-8 lg:mt-0 lg:justify-center lg:rounded-none lg:px-16">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col lg:flex-none">
          <h2 className="text-[26px] font-extrabold">Sign in</h2>
          <p className="mt-1 mb-6 text-[15px] font-medium text-muted">Lam Soon staff only.</p>
          <SignInPanel returnTo={returnTo} />
          <p className="mt-auto pt-8 text-center text-[13px] font-medium text-faint">
            Need access? Request Tally Sheet on the{" "}
            <a href={CENTRAL_PORTAL_HOME_URL} className="font-semibold text-primary hover:underline">
              Lam Soon PSG Portal
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
