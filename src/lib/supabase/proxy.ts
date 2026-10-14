import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { resolveCookieOptions } from "./cookieOptions";

/**
 * Refreshes the Supabase session cookie once per navigation, before any
 * page or Server Component runs — matches Central Portal's identical
 * helper (`Lam Soon PSG Portal/src/lib/supabase/proxy.ts`). Without this,
 * an expired access token only gets refreshed the next time something
 * calls `getClaims()` from a context that can actually write cookies (a
 * Server Action or Route Handler) — Server Components can read but not
 * write cookies, so without this the session would silently go stale on
 * pure-navigation requests.
 *
 * Called from `src/proxy.ts`, Next.js 16's renamed `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  let env;
  try {
    env = publicEnv();
  } catch {
    // Supabase isn't configured yet — let the request through as
    // logged-out rather than breaking every route.
    return response;
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.supabaseKey, {
    cookieOptions: resolveCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Establishes/refreshes the session; securely verifies the JWT rather
  // than trusting the cookie's decoded contents.
  await supabase.auth.getClaims();

  return response;
}
