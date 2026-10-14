import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()`.
//
// Deliberately does only session-cookie refresh here, matching Central
// Portal's identical proxy.ts — no route gating happens at this layer.
// Route protection lives in each route group's layout (see
// `src/app/(app)/layout.tsx`, which calls `requireRoomBookingUser()`) and
// in `/login`'s own page (which redirects away if already signed in) —
// the same division of responsibility Central Portal uses, and one that
// re-checks on every render rather than only at the top of a navigation.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon
     * - common static asset file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
