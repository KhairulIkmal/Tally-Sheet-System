import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, ClipboardList, Lock, PenLine, Printer, ShieldAlert } from "lucide-react";
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

const FEATURES = [
  { icon: Boxes, title: "Pallet by pallet", body: "Numbered like the stickers, totals worked out for you." },
  { icon: PenLine, title: "Signed at the dock", body: "Sign on the phone before the load leaves." },
  { icon: Printer, title: "Ready to print", body: "The office prints the same sheet you know." },
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#08152d] text-white">
      {/* The warehouse floor, under a navy wash: dense on the left where the words sit, open on the right. */}
      <div aria-hidden className="absolute inset-0">
        <picture>
          <source media="(min-width: 1024px)" srcSet="/login-warehouse.webp" />
          <img src="/login-warehouse-sm.webp" alt="" className="size-full object-cover object-[38%_70%] lg:object-center" />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,21,45,.72)_0%,rgba(8,21,45,.80)_45%,rgba(8,21,45,.95)_100%)] lg:bg-[linear-gradient(100deg,rgba(6,16,36,.96)_0%,rgba(8,22,48,.86)_38%,rgba(8,22,48,.45)_72%,rgba(8,22,48,.25)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(6,16,36,.7),transparent)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1240px] flex-1 flex-col lg:px-14">
        <header className="flex items-center justify-between px-6 pt-6 lg:px-0 lg:pt-9">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,.35)]">
              <LamSoonLogo className="size-9 object-contain" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold">Lam Soon PSG</div>
              <div className="font-condensed text-xs font-semibold tracking-[.14em] text-white/60 uppercase">Warehouse Operations</div>
            </div>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3.5 py-1.5 text-xs font-semibold text-white/75 backdrop-blur-sm sm:flex">
            <Lock aria-hidden className="size-3.5" /> Internal use only
          </span>
        </header>

        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-20 lg:py-12">
          <section className="px-6 pt-12 pb-10 lg:p-0">
            <div className="mb-5 flex items-center gap-3 font-condensed text-[13px] font-bold tracking-[.22em] text-white/70 uppercase">
              <span aria-hidden className="h-0.5 w-8 bg-[#e8463a]" />
              Count Tally Sheet
            </div>
            <h1 className="max-w-[620px] text-[40px]/[1.02] font-extrabold tracking-[-.02em] text-balance sm:text-[52px]/[1.02] lg:text-[68px]/[1]">
              Every pallet counted, signed and on record.
            </h1>
            <p className="mt-5 max-w-[500px] text-[16px]/relaxed font-medium text-white/75 lg:text-lg/relaxed">
              The warehouse tally sheet, on your phone. Count each pallet, sign at the dock, and the office has it ready to print.
            </p>
            <ul className="mt-10 hidden max-w-[560px] grid-cols-3 border-t border-white/15 pt-6 lg:grid">
              {FEATURES.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className={i ? "border-l border-white/15 pl-5" : "pr-5"}>
                  <Icon aria-hidden className="mb-2.5 size-5 text-[#ff8a7f]" />
                  <div className="text-[15px] font-bold">{title}</div>
                  <div className="mt-0.5 text-[13px]/snug font-medium text-white/60">{body}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-1 flex-col rounded-t-[28px] bg-surface px-6 pt-8 pb-7 text-ink shadow-[0_-12px_40px_rgba(0,0,0,.25)] lg:flex-none lg:rounded-[28px] lg:p-10 lg:shadow-[0_40px_100px_rgba(0,0,0,.5)]">
            <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
              <div className="mb-7 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary text-white">
                  <ClipboardList aria-hidden className="size-[22px]" />
                </span>
                <div className="leading-tight">
                  <div className="text-[17px] font-extrabold">Tally Sheet</div>
                  <div className="text-[13px] font-medium text-muted">Lam Soon staff only</div>
                </div>
              </div>
              <h2 className="text-[28px]/tight font-extrabold tracking-[-.01em]">Sign in</h2>
              <p className="mt-1.5 mb-6 text-[15px] font-medium text-muted">Use your Lam Soon work account, the same one as the Portal.</p>
              <SignInPanel returnTo={returnTo} />
              <p className="mt-auto border-t border-line-soft pt-5 text-center text-[13px] font-medium text-faint lg:mt-8">
                Need access? Request Tally Sheet on the{" "}
                <a href={CENTRAL_PORTAL_HOME_URL} className="font-semibold text-primary hover:underline">
                  Lam Soon PSG Portal
                </a>
                .
              </p>
            </div>
          </section>
        </div>

        <footer className="hidden pb-8 text-xs font-medium text-white/45 lg:block">© 2026 Lam Soon PSG</footer>
      </div>
    </main>
  );
}
