@AGENTS.md

# Lam Soon Tally Sheet System

Digital Count Tally Sheet: workers fill it on a phone, the office views and prints it. See README.md.

## Conventions

- **UI language: English only** (the design in `design/` is in Malay; it is reference only).
- **Timezone:** `Asia/Kuala_Lumpur`. Use `src/lib/tally/dates.ts`. Paper dates are `DD/MM/YY`; the database stores ISO dates.
- **Pure logic** lives in `src/lib/tally/*` (draft model, counting, warnings, payload, paper layout) and is unit-tested. Keep it free of React and server imports.
- **Auth:** shared Supabase session from the PSG Portal (`.lamsoonpsg.org` cookie in production). Guards in `src/lib/auth/dal.ts` (`requireUser`, `requireWorker`, `requireOffice`). Never derive roles in a page.
- **Data:** `storeFor(user)` in `dal.ts` returns the Supabase store (as the user, RLS applies) or, with `TALLY_DEMO=1` in development, the in-memory demo store. Both implement `TallyStore` (`src/lib/data/types.ts`).
- **Writes:** Server Actions in `src/lib/data/actions.ts` return `{ ok: true, data } | { ok: false, error, retry? }` and call the `tally.*` RPCs. The database re-checks everything.
- **Schema changes:** add a migration under `supabase/migrations/` and a pgTAP test under `supabase/tests/`; shared-project migrations are applied from the Portal repo.
- **Worker app** is one client page (`src/components/worker/worker-app.tsx`) that switches screens in memory so it survives losing signal. Drafts and the outbox are in localStorage, keyed by user id.

## Commands

`npm run dev:demo` (no database) · `npm run dev` · `npm run verify`
