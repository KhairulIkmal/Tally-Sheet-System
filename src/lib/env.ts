import { z } from "zod";

/**
 * Validated environment access. Parsing is lazy: a missing variable throws
 * the first time Supabase is used, not at build time.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(
    "NEXT_PUBLIC_SUPABASE_URL is required — set it in .env.local (see .env.example).",
  ),
  supabaseKey: z.string().min(
    1,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) is required — set it in .env.local.",
  ),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  cachedPublic ??= publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cachedPublic;
}

/**
 * Demo mode: an in-memory store and two demo users, so the UI can be tried
 * locally before the tally schema exists in Supabase. Never on in a
 * production build, whatever the variable says.
 */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.TALLY_DEMO === "1";
}
