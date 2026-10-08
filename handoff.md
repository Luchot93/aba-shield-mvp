# Session Handoff

_Last updated: 2026-10-07_

## 1. Goal we are moving towards

ACD-90 ("E1: Add automated tests proving staff can only see their own
data") — prove, with an automated test suite (not just the RLS policies
existing), that the role-scoped RLS model actually enforces what it
claims: admin sees everything; BCBA/BCaBA/RBT see only clients they're
assigned to; the same rule cascades to `checklist_items`, `documents`,
`activity_log`, `staff`, and `profiles`.

**Status: DONE. Suite built, verified, merged into `dev` via PR
[#118](https://github.com/Luchot93/aba-shield-mvp/pull/118), promoted to
`main` via PR [#119](https://github.com/Luchot93/aba-shield-mvp/pull/119).
Both merged, all CI checks green on both. Jira ACD-90 has a plain-English
closeout comment and has been transitioned to Done.**

## 2. Current state of the code

**Committed, merged into `dev`, promoted and merged into `main`. Local
`dev`/`main` fast-forwarded to origin.**

- **New test suite**: `tests/rls/` — a `node:test`-based suite, a
  separate track from Playwright (which mocks Supabase entirely via
  `createMockSupabaseClient()` and would never catch a broken/missing RLS
  policy). Runs against a **real** `@supabase/supabase-js` client against
  a real Postgres project. Files: `setup.js` (seed/teardown fixtures:
  1 admin, 1 BCBA, 1 BCaBA, 1 RBT, 2 clients), `clients.test.js`,
  `child-tables.test.js` (`checklist_items`/`documents`/`activity_log`),
  `staff-and-profiles.test.js`, `README.md`.
- **`package.json`**: added `test:rls` script. Had to use the glob form
  `node --test "tests/rls/*.test.js"` — the bare-directory form
  `node --test tests/rls` throws `MODULE_NOT_FOUND` on Node 24.12.0 (the
  version this machine and GitHub Actions both run).
- **`playwright.config.js`**: added `testIgnore: '**/rls/**'`. Playwright's
  default `testDir: './tests'` with no exclusion was picking up
  `tests/rls/*.test.js` as if they were Playwright specs, failing CI with
  a missing-`SUPABASE_URL` error (correct behavior — that CI job was never
  meant to have real Supabase credentials).
- **New dedicated non-production Supabase dev project** stood up for this
  suite to run against: name `aba-shield-rls-dev`, ref
  `aaqhoqzmkunsrfhcmlop`, region us-east-2, Postgres 17. All 23 local
  migration files were applied to it in chronological order so its schema
  matches production (`ABA_VAULT_MVP` / `qravuejkiluimaihhbrf`) exactly —
  13 tables, RLS enabled on all. **User explicitly decided to leave the
  project name as `aba-shield-rls-dev`** rather than renaming it (see
  section 4 — renaming isn't possible via MCP anyway).
- **`.env.rls`** (repo root, git-ignored via the existing `.env.*` pattern)
  holds `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` for
  that dev project. Not committed, never will be — local-only by design.

### QA / verification performed

- `npm run test:rls` — **28/28 pass** against the new dev project.
- Proved the suite actually catches regressions (per the ticket's own
  Testing/QA acceptance criterion): temporarily loosened the
  `clients select admin or assigned` policy to `using (true)` via a
  throwaway migration, reran the suite — exactly the 3 expected tests
  failed (BCBA/RBT/BCaBA cross-client visibility) — then reverted the
  policy via a second migration and reran — back to 28/28.
- PR #118 CI: `build`, `playwright`, `Vercel`, `Vercel Preview Comments`
  all green (after the `testIgnore` fix below).

### Jira / PR closeout

- PR [#118](https://github.com/Luchot93/aba-shield-mvp/pull/118)
  (`ACD-90-rls-automated-tests` → `dev`) merged.
- PR [#119](https://github.com/Luchot93/aba-shield-mvp/pull/119)
  (`dev` → `main`) **merged.** Its Playwright job hung for ~17 minutes on
  `npx playwright install --with-deps chromium` (transient GitHub Actions
  runner/mirror slowness, not a code issue); cancelled and reran via
  `gh run rerun --failed`, which completed cleanly in ~1m22s on retry. All
  checks green, merged into `main`.
- Jira ACD-90: plain-English closeout comment posted (what shipped, how
  it was verified, PR links, the `profiles` write-policy note below) and
  ticket transitioned to **Done**.
- No new bug ticket filed this session.

## 3. Files actively being edited

None — `tests/rls/*`, `package.json`, and `playwright.config.js` are all
committed, pushed, and merged into both `dev` and `main`. Only this file
(`handoff.md`) is being touched now. Local `dev` and `main` have already
been fast-forwarded to origin this session (`dev` → `c1fa986`, `main` →
`82cb6a0`).

## 4. Everything tried that failed / walked back — and deferred items

- **Project rename requested, not possible**: user asked to rename the
  new dev project to `Aba-Vault-Dev`. The Supabase MCP server has no
  rename/update-project tool (confirmed via full tool-list review) — it's
  dashboard-only (Project Settings → General → Project Name) and purely
  cosmetic (doesn't change the ref/URL). User was informed and then
  **explicitly decided to leave the name as `aba-shield-rls-dev`** rather
  than rename it manually. Don't re-raise this.
- **`node --test tests/rls` (bare directory) broken on Node 24.12.0**:
  threw `MODULE_NOT_FOUND` locally and in CI. Not a design decision, a
  runtime regression — fixed by switching to the glob form in both the
  local run and `package.json`'s `test:rls` script.
- **First push of PR #118 failed CI** (`playwright` check): Playwright's
  default test discovery picked up `tests/rls/*.test.js` and failed on a
  missing `SUPABASE_URL`, since that CI job intentionally has no Supabase
  credentials. Fixed with `testIgnore: '**/rls/**'` in
  `playwright.config.js`, pushed a second commit, all checks went green.
- **Migration-replay idempotency conflicts** while applying the 23
  migrations to the fresh dev project (replaying a chronological history
  including a `pg_dump` baseline snapshot against an empty project hits
  `CREATE SCHEMA public` / duplicate `CREATE FUNCTION` collisions) — fixed
  with `CREATE SCHEMA IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION`,
  final schema state unaffected.
- **One migration applied from memory instead of reading the file
  first** (`20260928140000_client_denial_staff_contact_fields.sql`):
  applied `denial_count integer default 0` (nullable) when the real file
  specifies `not null default 0`. Caught by reading the actual file
  afterward and comparing; fixed with a corrective
  `alter column denial_count set not null` migration. Adopted a stricter
  rule for the rest of that session: read every migration file via `cat`
  immediately before applying it, never from memory/paraphrase.

## 5. Next steps

1. ACD-90 is fully closed: PR #118 and PR #119 merged, Jira Done, local
   `dev`/`main` fast-forwarded to origin. Nothing outstanding for this
   ticket.
2. Everything from the ACD-82 through ACD-89 handoffs' carried-forward
   "Next steps" list (ACD-113, ACD-112, ACD-111, ACD-101, ACD-109,
   ACD-110, ACD-100, ACD-105, ACD-106, ACD-99, the `FLAGS.PIPELINE`
   flip-gated QA items, branch cleanup, and the `suggestFromLabel`
   fallback note) is still outstanding and unrelated to ACD-90 — carried
   forward as a pointer rather than reproduced in full; see git history
   for the 2026-10-07 (ACD-89) version of this file if needed.
