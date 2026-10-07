# tests/rls

Automated tests proving the role-scoped RLS model (ACD-90) actually enforces
what it claims: admin sees everything; BCBA/BCaBA/RBT see only clients they
are assigned to (via `clients.bcba_id` / `clients.rbt_id`), and the same rule
cascades to `checklist_items`, `documents`, `activity_log`, `staff`, and
`profiles`.

This is a **separate test track from Playwright**, not a replacement for it.
Every existing Playwright spec runs with `VITE_E2E=1`, which swaps in
`createMockSupabaseClient()` (`src/lib/e2e/mockSupabase.js`) and an
in-memory/localStorage store (`src/lib/e2e/store.js`) for every table
read/write — no Playwright spec ever talks to real Postgres, so a broken or
missing RLS policy would never fail CI today. These tests use the real
`@supabase/supabase-js` client against a real Supabase project instead, via
Node's built-in test runner (`node:test`), rather than fighting Playwright's
intentional mocking.

## ⚠️ Target a non-production Supabase project — never `ABA_VAULT_MVP`

This suite creates and deletes real `auth.users`, `profiles`, `clients`,
`checklist_items`, `documents`, `activity_log`, and `staff` rows on whatever
project `SUPABASE_URL` points at.

**Do not point this at `ABA_VAULT_MVP` (`qravuejkiluimaihhbrf`) or any other
production project.** Point it at a staging project, or a disposable
Supabase branch, instead.

## Required environment variables

Put these in a `.env.rls` file at the repo root (already covered by the
`.env.*` pattern in `.gitignore`, so it will never be committed):

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key. **Never commit this, never expose it to a browser bundle.** Used here only for fixture setup/teardown — it bypasses RLS entirely, so it can't be used in any assertion. |
| `SUPABASE_ANON_KEY` | Same page → `anon`/`public` key. Not secret — same value as `VITE_SUPABASE_ANON_KEY`, needed here (unprefixed) because these tests run directly under Node, not through Vite. Used to sign in as each fixture user so assertions run exactly as that user would hit the real API. |

## Running

```
npm run test:rls
```

This runs `node --env-file=.env.rls --test tests/rls` — Node's built-in test
runner (requires Node ≥ 20.6; this repo runs Node 24). No new test framework
or dependency was added.

## What each file covers

- **`setup.js`** — not a test file. Exports `seed()` / `teardown()` (creates
  and tears down one admin, one BCBA, one BCaBA, one RBT real `auth.users`
  row + matching `profiles`/`staff` rows, and two `clients` rows — one
  assigned to the BCBA/RBT pair, one assigned elsewhere) and
  `clientFor(email, password)`, which signs in as a fixture user via
  `supabase-js` so assertions hit the real RLS-enforced API, not the
  service-role client.
- **`clients.test.js`** — admin sees both fixture clients; the assigned
  BCBA/RBT see only their own (zero rows, not an error, for the other); the
  unassigned BCaBA sees zero rows for both; a non-admin attempt to reassign
  `bcba_id`/`rbt_id` is rejected by the A1 trigger; a non-admin can still
  update other fields on their own assigned client.
- **`child-tables.test.js`** — the same admin/assigned/unassigned matrix for
  `checklist_items`, `documents`, and `activity_log`, plus confirming an
  unassigned write attempt is actually rejected, not just hidden from reads.
- **`staff-and-profiles.test.js`** — any authenticated role can read all
  `staff`/`profiles` rows; only admin can write `staff`. **Note:** `profiles`
  currently has zero INSERT/UPDATE/DELETE policies for anyone, including
  admin, via the client API — role changes are service-role/dashboard-only
  by design (see `supabase/migrations/20260714221150_profiles_table.sql`).
  This suite asserts that actual, stricter behavior rather than "admin can
  change `profiles.role`" as literally stated in the ACD-90 acceptance
  criteria — flag this if product intent is for admins to change roles from
  within the app, since that would need a new policy or an RPC.

## Proving the tests actually catch regressions

Before trusting this suite, temporarily loosen one policy on purpose — e.g.
change the `clients select admin or assigned` policy's `using` clause to
`true` — and confirm the relevant test fails. Revert the policy afterward.

## Fixture isolation and teardown

Each `seed()` call generates a unique run id and uses it in every fixture
email/client name, so repeated runs never collide. `teardown()` deletes the
two fixture clients (cascades to their `checklist_items`/`documents`/
`activity_log` rows via `on delete cascade`), explicitly deletes the four
fixture `staff` rows (no cascade on `staff.user_id` — must happen before the
next step or it fails on a foreign key violation), then deletes the four
fixture `auth.users` (cascades to `profiles`). If a run is interrupted before
teardown runs, fixture rows are identifiable by the
`rls-*-<runId>@test.abashield.local` email pattern and the
`RLS Fixture Client` name prefix, for manual cleanup.
