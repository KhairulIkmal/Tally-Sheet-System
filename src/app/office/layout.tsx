import Link from "next/link";
import { hasRole, requireOffice } from "@/lib/auth/dal";
import { LamSoonLogo } from "@/components/brand";
import { OfficeNav } from "@/components/office/office-nav";
import { HeaderClock } from "@/components/office/header-clock";
import { UserMenu } from "@/components/office/user-menu";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOffice();
  const roleLabel = user.roles.map((r) => (r === "office" ? "Office" : "Worker")).join(" · ");
  return (
    <div className="flex h-dvh min-w-[1024px] flex-col bg-canvas text-ink print:block print:h-auto print:min-w-0 print:bg-white">
      <header data-noprint className="flex h-[64px] flex-none items-center gap-7 bg-[#15181d] px-7 text-white">
        <Link href="/office" className="flex items-center gap-2.5 text-xl font-extrabold">
          <LamSoonLogo className="h-9 w-auto" />
          Tally Sheet
        </Link>
        <OfficeNav />
        <span className="flex-1" />
        <HeaderClock />
        <span aria-hidden className="h-8 w-px bg-white/15" />
        <UserMenu
          name={user.name}
          email={user.email}
          initials={user.initials}
          roleLabel={roleLabel}
          department={user.department}
          canOpenWorker={hasRole(user, "worker")}
        />
      </header>
      {children}
    </div>
  );
}
