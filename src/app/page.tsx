import { redirect } from "next/navigation";
import { homePathFor, requireUser } from "@/lib/auth/dal";
import { isDemoMode } from "@/lib/env";
import { isCrossDomainSsoTopology } from "@/lib/supabase/cookieOptions";

export default async function Home() {
  // The Portal launches Tally at its root: show our sign-in page ("Continue as …"), like Room Booking,
  // instead of jumping straight in. The phone app starts at /worker, so it still opens directly.
  if (!isDemoMode() && isCrossDomainSsoTopology()) redirect("/login");
  const user = await requireUser();
  redirect(homePathFor(user));
}
