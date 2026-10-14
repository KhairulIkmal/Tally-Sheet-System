import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCrossDomainSsoTopology, resolveCookieOptions } from "./cookieOptions";

// Each case sets exactly the cookie env it needs: CI builds define the real
// shared-cookie build variables, which must not leak into these cases.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_NAME", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveCookieOptions", () => {
  it("resolves to @supabase/ssr's own defaults for plain local development (no name, no domain, not secure)", () => {
    expect(resolveCookieOptions()).toEqual({ path: "/", sameSite: "lax" });
    expect(isCrossDomainSsoTopology()).toBe(false);
  });

  it("applies a custom cookie name without requiring a domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_NAME", "lspsg-auth");
    expect(resolveCookieOptions()).toEqual({ path: "/", sameSite: "lax", name: "lspsg-auth" });
  });

  it("applies the production cookie contract when the exact allowed domain is set — name, domain, path, secure, sameSite", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_NAME", "lspsg-auth");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN", ".lamsoonpsg.org");
    expect(resolveCookieOptions()).toEqual({
      path: "/",
      sameSite: "lax",
      name: "lspsg-auth",
      domain: ".lamsoonpsg.org",
      secure: true,
    });
    expect(isCrossDomainSsoTopology()).toBe(true);
  });

  it("ignores an unsafe/unrecognized cookie domain rather than trusting it", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN", ".evil.example.com");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveCookieOptions()).toEqual({ path: "/", sameSite: "lax" });
    expect(warn).toHaveBeenCalled();
    expect(isCrossDomainSsoTopology()).toBe(false);
  });

  it("ignores a bare domain with no leading dot (would scope only to the apex, not what's expected)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN", "lamsoonpsg.org");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveCookieOptions()).toEqual({ path: "/", sameSite: "lax" });
  });

  it("resolves to the exact same contract as Central Portal's identical resolver for the same env vars", () => {
    // This app's copy of cookieOptions.ts is deliberately kept byte-for-byte
    // equivalent in behavior to `Lam Soon PSG Portal/src/lib/supabase/
    // cookieOptions.ts` — this pins the production shape both apps must
    // agree on for the shared session cookie to be readable by both.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_NAME", "lspsg-auth");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN", ".lamsoonpsg.org");
    expect(resolveCookieOptions()).toEqual({
      name: "lspsg-auth",
      domain: ".lamsoonpsg.org",
      path: "/",
      secure: true,
      sameSite: "lax",
    });
  });
});
