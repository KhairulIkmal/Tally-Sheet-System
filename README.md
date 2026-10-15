# Tally Sheet System

The paper **Count Tally Sheet** used when goods leave the Lam Soon warehouse, as a phone/tablet app for warehouse workers and a desktop view for the office.

- **Worker (phone/tablet):** choose Container or Lorry → header → type the item name (names used before are suggested as you type) and its unit (CTN, TIN or other) → enter the total and qty per pallet and the pallets are generated → fill batch / expired / prod per pallet ("same as above" copies the pallet above; "+ Add batch" makes a mixed pallet) → packing materials → review → sign with a finger → preview the A4 sheet → submit.
- **Office (desktop):** list of submitted sheets (search, date/form/status filters, refreshes every 30 s), sheet detail with an A4 preview, **Print (A4)** laid out like the paper form, **Mark as printed**, and the item history (fix typos, hide entries).

Pallet numbers are the sticker numbers: 1..n across the sheet, in item order. A mixed pallet prints as one row with stacked batch/expired/prod/qty values. Over 25 pallets continues on page 2.

The UI is built from the Claude Design prototype in [design/](design/) (reference only).

## Stack

Next.js 16 (App Router, `src/proxy.ts`) · React 19 · TypeScript · Tailwind CSS v4 · shared Supabase project (schema `tally`) · Cloudflare Workers via OpenNext · Vitest. Same setup as Room Booking.

## Run locally

```bash
npm install
npm run dev:demo
```

Open http://localhost:3200. **Demo mode** keeps data in memory on this computer (lost when the server stops) and offers a demo worker, office user, or both. No database needed. It is never active in a production build.

Against the real shared Supabase (after the migration is applied), use `npm run dev` and sign in with a Portal account that has Tally Sheet access.

Checks: `npm run verify` (lint, typecheck, unit tests, build).

## Offline

The worker app keeps working without signal:

- The draft is saved on the phone on every change (per user, in localStorage).
- A signed sheet goes into an outbox and is sent straight away, or when the phone is back online (checked on reconnect and every 30 s). `tally.submit_sheet()` is idempotent on the sheet's `clientId`, so a retry never creates a second sheet.
- In production a service worker (`public/sw.js`) caches `/worker` so the app reopens without signal.

## Items and units

Workers type item names; there is no product master. Every submitted item name is saved to `tally.item_history` with its unit and qty per pallet, and suggested on the next sheet as soon as the worker starts typing (names starting with the text first). The phone also remembers its own recent items, so suggestions work offline.

QTY is counted in each item's unit (CTN, TIN, or a typed unit). Totals are kept per unit ("150 CTN · 40 TIN") and never added across units. On the printed sheet the QTY cell shows just the number for CTN, as on paper, and "40 TIN" for other units.

## Database

[`supabase/migrations/20261015000000_tally_sheet_schema.sql`](supabase/migrations/20261015000000_tally_sheet_schema.sql) creates the `tally` schema and registers the system:

- System `tally_sheet` (admin-managed, launch mode `sso`, starts as **coming-soon**) with roles `worker` and `office`.
- Tables `item_history`, `sheets`, `sheet_items`, `sheet_pallets`, `pallet_lines`, `sheet_events`. Clients can only `select` under RLS: a worker reads their own sheets, the office reads all.
- Writes only through `tally.submit_sheet(jsonb)`, `tally.set_sheet_printed(uuid, boolean)` and `tally.save_history_item(...)`, which check the role from `auth.uid()`.

pgTAP suite: [`supabase/tests/tally_sheet.test.sql`](supabase/tests/tally_sheet.test.sql) (30 tests). It passed on the local harness on top of the full Portal migration history (Portal `origin/main` at 2026-10-14).

## Going live (not done yet)

1. **Migration.** Copy the migration into `Lam Soon PSG Portal/supabase/migrations/`. Run `npx supabase migration list --linked` and renumber if `20261014000000` is taken. Dry-run, then apply with `db push` (move aside unapplied files such as `20261008000100_portal_email_enable.sql`; never `--include-all`).
2. **Expose the schema.** Supabase Dashboard → Project Settings → API → *Exposed schemas*: add `tally`.
3. **Item history** starts empty and fills itself as workers submit sheets. The office can tidy it on **Office → Item history**.
4. **Deploy.** Create a GitHub repo and push, then `npm run deploy` (or Workers Builds). `wrangler.jsonc` already sets the shared Supabase URL and publishable key and `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN=.lamsoonpsg.org`. Add a custom domain such as `tally.lamsoonpsg.org`.
5. **Portal.** Admin → Systems → *Tally Sheet*: set the address to the custom domain and switch the card to **online**. Approve people's access requests with the **Worker** or **Office** role.

Rollback: remove the custom domain / set the card back to coming-soon. The migration is additive; the `tally` schema can stay.
