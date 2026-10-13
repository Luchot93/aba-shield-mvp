# Session Handoff

_Last updated: 2026-10-13_

## 1. Goal we are moving towards

ACD-96 ("E7: Run the data-access security tests automatically on every
code change") — E1 (ACD-90) created `test:rls`, a Node-based test suite
proving the role-scoped RLS model actually enforces admin-vs-assigned
data access. It had to be run by hand, so a regression could land
without anyone noticing. This story wires `test:rls` into CI so it runs
automatically on every PR/push to `main`/`dev`, fails the check clearly
on a real failure, and never silently no-ops if its secrets are missing
— a green check here must mean the suite actually ran against real
Postgres RLS policies, not that it skipped.

**Status: DONE, merged to `main` — deployed to production.**

- PR [#140](https://github.com/Luchot93/aba-shield-mvp/pull/140)
  (`ACD-96-ci-rls-tests` → `dev`) merged.
- PR [#141](https://github.com/Luchot93/aba-shield-mvp/pull/141)
  (`dev` → `main`) merged.
- Jira ACD-96 commented (plain-English summary + PR links) and
  transitioned to **Done**.

## 2. Current state of the code

**Committed, merged into `dev` and `main`. No DB/migration changes —
this ticket only adds a GitHub Actions workflow; `test:rls` itself and
the fixtures it drives already existed from ACD-90.**

- **New `.github/workflows/rls.yml`**: same `push: [main, dev]` /
  `pull_request` triggers as the existing `ci.yml`/`e2e.yml`. Steps:
  checkout → setup-node (pinned to **Node 24**, not 20 like the other
  two workflows — see failure note below) → `npm ci` → a dedicated
  "Verify RLS Supabase secrets are configured" step that checks
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` are
  non-empty and `exit 1`s with a named-secret `::error::` if not →
  writes `.env.rls` on the runner from those env vars → `npm run
  test:rls`.
- **Three new GitHub Actions repository secrets**, already set by the
  user (not by this session — secret values are never entered by
  Claude per policy): `RLS_SUPABASE_URL`, `RLS_SUPABASE_SERVICE_ROLE_KEY`,
  `RLS_SUPABASE_ANON_KEY`. Deliberately `RLS_`-prefixed, not the bare
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` names — those bare names
  are already the *production* Vercel env var names per `.env.example`,
  and reusing them as GitHub secret names would invite pasting the prod
  value in by habit. All three point at the non-production
  `aba-shield-rls-dev` project (`aaqhoqzmkunsrfhcmlop`), verified by
  reading back the `SUPABASE_URL` secret's value (URL only, no key
  material) before trusting it — never `ABA_VAULT_MVP`
  (`qravuejkiluimaihhbrf`).

### Testing performed this session

- **Local, before pushing**: ran the fail-loud secret-check bash logic
  with all three vars unset — confirmed `exit 1` naming all three
  missing secrets by their `RLS_`-prefixed names. Ran `npm run
  test:rls` directly against `aba-shield-rls-dev` (already had a local
  `.env.rls` from a prior session) — 42/42 passing.
- **CI, via PR #140**: first push failed — see section 4. After the
  Node 24 fix, all three checks (`CI`, `E2E`, `RLS`) went green; `RLS`
  showed the same 42/42 passing inside the hosted runner.

## 3. Files actively being edited

None — everything is committed, pushed, merged into `dev` and `main`.
Only this file (`handoff.md`) is being touched now.

## 4. Everything tried that failed / walked back — and deferred items

- **First CI push failed, root-caused and fixed in the same session —
  not walked back, just a real bug caught by the CI run itself.**
  `rls.yml` initially pinned `node-version: 20` (copied from
  `ci.yml`/`e2e.yml`). `package.json`'s `test:rls` script passes a
  *quoted* glob straight to `node --test`
  (`node --env-file=.env.rls --test "tests/rls/*.test.js"`), so the
  shell never expands it — Node's own test runner has to resolve the
  glob. On Node 20 it can't: the run failed with `Could not find
  '.../tests/rls/*.test.js'`. `tests/rls/README.md` already documented
  "this repo runs Node 24" for this suite, and the local run (on Node
  24) had worked fine, which was the tell. Fix: bumped `node-version`
  to `24` in `rls.yml` only — `ci.yml`/`e2e.yml` stay on 20 since they
  never invoke `test:rls`. Confirmed green on the next CI run.
  **Worth remembering for any future workflow that touches `test:rls`
  or other `node --test` glob invocations: Node 20 cannot resolve a
  quoted glob arg to `--test`; Node 24 can. Don't re-copy the Node 20
  pin from `ci.yml`/`e2e.yml` onto a job that runs `test:rls`.**
- **No new pending debt surfaced this session** — scope was fully
  closed out (workflow added, secrets wired, Node version bug found
  and fixed, all before merge) with no deferred follow-on work and no
  new ticket needed.

## 5. Next steps

1. **ACD-115** (Tailwind/Vite major-version upgrade, from ACD-94) —
   still unstarted. Needs a breaking-change evaluation (Tailwind v3→v4
   and/or Vite major bump) before merging; the 3 closed Dependabot PRs
   (#128/#129/#130) are a reference starting point only.
2. Carried over from ACD-92's handoff, still unstarted — **the
   follow-up re-test of `manage-staff`'s invite happy-path** once this
   Supabase project's invite emails aren't rate-limited (commented on
   ACD-92 already, not a new ticket).
3. **ACD-101** (DNS/Resend domain verification) — still To Do,
   unassigned, still blocked on owning/controlling a real domain.
   Unchanged.
4. This sprint's actual stated focus (per user, 2026-10-08, carried
   over across the last several sessions) is still **Staff, CRM
   Pipeline + new service checklist, and the standalone service
   session logs feature** — none of that has been touched in the
   ACD-92 through ACD-96 sessions; fully unstarted from here.
5. Carried forward, unrelated to ACD-96 (pointer only, not reproduced
   here): the `openClientTab` Playwright helper bug, and everything
   from the ACD-82 through ACD-92 handoffs' outstanding items
   (ACD-113, ACD-112, ACD-111, ACD-109, ACD-110, ACD-100, ACD-105,
   ACD-106, ACD-99, the `FLAGS.PIPELINE` flip-gated QA items, and the
   `suggestFromLabel` fallback note) — see git history for earlier
   handoff versions if needed.
