/**
 * Validates a `returnTo` query value as a safe, same-origin relative path.
 * Matches Central Portal's identical validator
 * (`Lam Soon PSG Portal/src/lib/return-to.ts`) — kept in sync deliberately,
 * since both apps need the exact same guarantee against an open redirect.
 *
 * Rejects anything that could be interpreted as leaving the app:
 * - values that don't start with a single `/` (not relative, or `//host`
 *   protocol-relative, which browsers treat as `https://host`)
 * - values containing `://` (an absolute URL smuggled into the path)
 * - backslashes anywhere (`/\evil.com` normalises to `//evil.com` in some
 *   browsers)
 * - control characters or whitespace (used to defeat naive prefix checks)
 */
export function safeReturnTo(raw: string | string[] | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (/[\u0000-\u001f\u007f\s]/.test(decoded)) return null;
  if (decoded.includes("\\")) return null;
  if (decoded.includes("://")) return null;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;

  return decoded;
}
