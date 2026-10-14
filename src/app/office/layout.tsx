import Link from "next/link";
import { hasRole, requireOffice } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { OfficeNav } from "@/components/office/office-nav";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOffice();
  return (
    <div className="flex h-dvh min-w-[1024px] flex-col bg-canvas text-ink print:block print:h-auto print:min-w-0 print:bg-white">
      <header data-noprint className="flex h-[60px] flex-none items-center gap-7 bg-[#15181d] px-7 text-white">
        <Link href="/office" className="text-xl font-extrabold">
          Tally Sheet
        </Link>
        <OfficeNav />
        <span className="flex-1" />
        {hasRole(user, "worker") ? (
          <Link href="/worker" className="text-sm font-semibold text-[#9dbbff]">
            Open worker app →
          </Link>
        ) : null}
        <span className="text-sm font-medium opacity-80">{user.name}</span>
        <form action={signOut}>
          <button type="submit" className="text-sm font-semibold opacity-80 hover:opacity-100">
            Sign out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
