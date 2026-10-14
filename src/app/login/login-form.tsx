"use client";

import { useState, useTransition } from "react";
import { signIn } from "@/lib/auth/actions";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) =>
        startTransition(async () => {
          setError("");
          const res = await signIn(formData);
          if (res && !res.ok) setError(res.error ?? "Couldn't sign you in.");
        })
      }
    >
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-body">Company email</span>
        <input name="email" type="email" autoComplete="username" required className="h-12 rounded-[10px] border-[1.5px] border-field bg-surface px-3.5 text-base font-semibold outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-body">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="h-12 rounded-[10px] border-[1.5px] border-field bg-surface px-3.5 text-base font-semibold outline-none focus:border-primary" />
      </label>
      {error ? <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-ink">{error}</div> : null}
      <button type="submit" disabled={pending} className="h-12 rounded-xl bg-primary text-base font-bold text-white disabled:opacity-50">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-[13px] font-medium text-muted">Use your Lam Soon PSG Portal account. Local development only; live, the Portal signs you in.</p>
    </form>
  );
}
