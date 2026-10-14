import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * The only cookie domain this contract will ever apply — identical to
 * Central Portal's own resolver (`Lam Soon PSG Portal/src/lib/supabase/
 * cookieOptions.ts`), which this file is a deliberate copy of so a session
 * cookie set by either app is readable by the other. Confirmed officially
 * supported by the installed @supabase/ssr@0.12.7: both createServerClient
 * and createBrowserClient accept `cookieOptions: CookieOptionsWithName`,
 * i.e. `{ name?: string } & Partial<SerializeOptions>` (domain, path,
 * secure, sameSite, ...) — see node_modules/@supabase/ssr/dist/main/
 * types.d.ts.
 */
const PRODUCTION_COOKIE_DOMAIN = ".lamsoonpsg.org";

/**
 * True only when this deployment is configured for the real cross-domain
 * SSO topology (the shared cookie domain is set) — used elsewhere in this
 * app to decide whether an unauthenticated redirect should leave this
 * origin for Central Portal's login, or stay on the local /login page for
 * plain local development.
 */
export function isCrossDomainSsoTopology(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN === PRODUCTION_COOKIE_DOMAIN;
}

/**
 * Resolves the Supabase SSR cookie contract shared with Central Portal, so
 * a session started on either lamsoonpsg.org subdomain is readable by the
 * other. Used identically by the browser and server clients.
 *
 * Both env vars are optional and unset by default — local development gets
 * @supabase/ssr's own defaults (a generated per-project cookie name,
 * host-only cookie, no `secure`), so `npm run dev` against localhost is
 * unaffected. The production Worker config sets both explicitly.
 *
 * `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` is checked against a fixed allowlist
 * rather than trusted as-is: a mistyped or malicious domain value would
 * otherwise silently widen (or misdirect) where the session cookie is
 * readable, so an unrecognized value is dropped rather than applied.
 */
export function resolveCookieOptions(): CookieOptionsWithName {
  const options: CookieOptionsWithName = {
    path: "/",
    sameSite: "lax",
  };

  const name = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_NAME;
  if (name) options.name = name;

  if (isCrossDomainSsoTopology()) {
    options.domain = PRODUCTION_COOKIE_DOMAIN;
    options.secure = true;
  } else if (process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN) {
    console.warn(
      `Ignoring unrecognized NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN value — expected "${PRODUCTION_COOKIE_DOMAIN}" or unset.`,
    );
  }

  return options;
}
