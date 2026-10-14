import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { resolveCookieOptions } from "./cookieOptions";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in user (RLS applies). Create one per request.
 * Default schema is `tally`; identity reads go through `tally.me()`.
 *
 * `cookies()` throws on write during a Server Component render; the
 * `setAll` below swallows that case because `src/proxy.ts` refreshes the
 * session cookie on every navigation.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.supabaseKey, {
    db: { schema: "tally" },
    cookieOptions: resolveCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — proxy.ts covers the refresh.
        }
      },
    },
  });
}
