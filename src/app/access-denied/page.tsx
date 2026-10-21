import type { Metadata } from "next";
import { signOut } from "@/lib/auth/actions";
import { CENTRAL_PORTAL_HOME_URL } from "@/lib/auth/central-portal";
import { DENIED_COPY } from "@/lib/auth/denied-copy";

export const metadata: Metadata = { title: "No access" };


export default async function AccessDenied({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-6">
        <div className="mb-2 text-2xl font-extrabold">No access</div>
        <p className="mb-5 text-base font-medium text-body">{DENIED_COPY[reason ?? ""] ?? DENIED_COPY.no_access}</p>
        <div className="flex gap-2">
          <a href={CENTRAL_PORTAL_HOME_URL} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary font-bold text-white">
            Open the Portal
          </a>
          <form action={signOut} className="flex-1">
            <button type="submit" className="h-11 w-full rounded-xl border-[1.5px] border-field font-bold">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
