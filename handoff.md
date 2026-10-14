# Session Handoff

_Last updated: 2026-10-14_

## 1. Goal we are moving towards

ACD-99 ("C1: Flip the feature flags to launch the pipeline and staff
management for real") — flip `FLAGS.PIPELINE`/`FLAGS.STAFF` to `true` so
the Pipeline CRM/Kanban and Staff Directory become live, shipped features
instead of gated Phase 2 code, then confirm nothing is broken and no
acceptance-criteria item is left open (build, manual click-through, no
orphaned old-flag checks, and a review of the ACD-97 axe-core accessibility
scan results).

**Status: code + docs complete and committed on the feature branch. Not
yet merged, not yet pushed to origin.**

## 2. Current state of the code

**Committed locally on branch `ACD-99-flip-pipeline-staff-flags` (2 commits,
`1ae34da` and `dcad0c7`). Not pushed to origin, not merged into `dev` or
`main`. No DB/migration changes.**

- `src/constants/featureFlags.js`: `PIPELINE: true`, `STAFF: true`.
  `REASSESSMENT`/`REAUTH`/`METRICS`/`VOICE_CAPTURE` untouched at `false`.
- Grep-swept every remaining `FLAGS.PIPELINE`/`FLAGS.STAFF` gate — all are
  legitimate conditional-render gates that now correctly activate; nothing
  orphaned.
- **E2E mock-backend gaps fixed** (QA surfaced these only once the flags
  made the code paths reachable — not new bugs, pre-existing scaffolding
  gaps): `src/lib/db.js` got `IS_E2E` branches for `getStaff`,
  `createStaff`, `getStaffByUserIds`, `updateStaff`, `updateClient`,
  `logActivity`, and the three session-log getters (short-circuit to `[]`
  under E2E — no mock session-log data model exists yet). `src/lib/e2e/store.js`
  got `staff`/`activityLog` arrays (seeded from `SEED_STAFF()`) plus
  matching CRUD exports. `src/lib/e2e/mockSupabase.js` got `auth.getUser()`
  and a `functions.invoke('manage-staff', ...)` mock implementing the real
  edge function's invite/revoke validation shape.
- **Accessibility (ACD-97 axe-core) AC item triaged and resolved for its
  blocking portion**: `tests/accessibility.spec.js`'s previously-always-skipped
  Pipeline/Staff blocks now execute for real. Found 2 critical violations
  (`label` on Client Detail's checklist checkbox/date inputs, `select-name`
  on Staff Directory's sort dropdown) — fixed with minimal `aria-label`
  additions in `ClientDetailPage.jsx`/`StaffPage.jsx`, verified by re-test.
  `color-contrast` (serious) persists on every page including pages that
  shipped before this ticket — correctly scoped out as a pre-existing,
  cross-cutting design-token issue, not fixed here.
- `CLAUDE.md` updated to reflect Pipeline/Staff as shipped (removed from
  "What This Repo Is NOT", Project Structure GATED→ACTIVE labels, Client
  Object Shape and db.js Pattern sections refreshed to match current code).
- `docs/ACD-99-flag-flip-qa-report.md` is the full diagnosis/fix/re-test
  record for this ticket (§1-8 original diagnosis, §9-10 mock-backend fix
  + re-test, §12 accessibility triage/fix/re-test). Status: RESOLVED.

## 3. Files actively being edited

None under active edit — only `handoff.md` is being touched now, at
session close.

Files changed this session (both commits, all already committed):
`src/constants/featureFlags.js`, `src/lib/db.js`, `src/lib/e2e/store.js`,
`src/lib/e2e/mockSupabase.js`, `src/features/detail/ClientDetailPage.jsx`,
`src/features/staff/StaffPage.jsx`, `CLAUDE.md`,
`docs/ACD-99-flag-flip-qa-report.md`.

## 4. Everything tried that failed / walked back — and deferred items

- **Nothing walked back on the core flag flip** — it was clean on the
  first pass (build succeeded, no orphaned flag checks found).
- **Accessibility probe script friction**: a temporary `tests/a11y-probe.spec.js`
  (created to dump exact axe violation nodes/selectors, since the main
  spec only logs counts) first tried `page.keyboard.press('Escape')` to
  back out of the Client Detail view before navigating to Staff — this
  timed out, because Client Detail is a full-page view
  (`data-testid="client-detail-modal"` but `fixed inset-0`, not a true
  dismissible modal), not Escape-closeable. Worked around by starting the
  second probe pass fresh from Staff instead of fixing the in-place
  navigation, since the needed Client Detail data had already been
  captured from the partial run. The probe script itself was deleted after
  use — not part of the permanent test suite.
- **Deliberately did not fix `color-contrast`** inside this ticket even
  though it's technically an axe finding on the newly-gated pages — it's
  present on Clients/New Client form too (shipped long before Pipeline/Staff
  existed), so it's cross-cutting design-token debt, not something this
  ticket introduced. Filed separately (ACD-117) rather than scope-creeping
  ACD-99.
- **Test-suite debt found but not fixed inline**: re-running
  `tests/pipeline.spec.js` post-mock-backend-fix surfaced 16-18 failures
  (count varies by scope: 16 on the narrower 3-describe-block `-g` run used
  in QA report §10, 18 on a full-file regression run that also covers
  Notifications/Services-Reauth blocks). Every one was individually
  root-caused to either a stale test assertion (rebranding string, stale
  seed-data counts, stale column count, stage-gated UI the test didn't
  account for, an intentional "Save to Directory" vs. "Save & Add to
  Pipeline" product behavior, a wrong field key) or an out-of-scope REAUTH
  assertion (FLAGS.REAUTH is still `false` by product decision). None are
  app bugs, none are regressions from this ticket's code changes — filed as
  **ACD-116** rather than fixed inline, since full test-suite remediation
  is out of ACD-99's scope.

## 5. Next steps

1. **This session's own unfinished step**: decide whether to merge
   `ACD-99-flip-pipeline-staff-flags` into `dev` (push branch, open PR) —
   not done yet, pending user go-ahead next session.
2. **ACD-116** — 16-18 stale/incorrect `tests/pipeline.spec.js` assertions
   (test-suite debt, categorized and ready to fix; not started).
3. **ACD-117** — app-wide `color-contrast` axe findings (shared teal/slate
   design tokens below WCAG AA 4.5:1 on every page tested); not started.
   Acceptance criteria already drafted on the ticket (target token shades,
   apply across shared components, re-run `tests/accessibility.spec.js`
   clean, visual-regression spot-check with product/design).
4. **ACD-115** (Tailwind/Vite major-version upgrade, from ACD-94) — still
   unstarted, carried over unchanged from prior sessions.
5. Carried over from ACD-92 — the follow-up re-test of `manage-staff`'s
   invite happy-path once Supabase's invite emails aren't rate-limited.
   Still unstarted.
6. **ACD-101** (DNS/Resend domain verification) — still To Do, unassigned,
   still blocked on owning/controlling a real domain. Unchanged.
7. Not investigated this session: the Login-page a11y test flakiness
   noted in QA report §6.4/§10 (passed in isolation, failed in one full
   23-minute combined run) — possibly cross-test state bleed in the
   long-lived mock-backend process. Worth a look if it recurs.
8. Per memory note from a prior session: sync local `main`/`dev` to
   `origin` before/at next session's close (not done this session — this
   session never touched `main`/`dev`, stayed entirely on the feature
   branch).
9. Carried forward, unrelated to ACD-99 (pointer only, not reproduced
   here): the `openClientTab` Playwright helper bug, Dependabot PR #137's
   `@sentry/react` major-version bump (merged to `main` outside a session,
   not yet re-verified against `sentry.js`'s API usage), and everything
   from the ACD-82 through ACD-98 handoffs' outstanding items (ACD-113,
   ACD-112, ACD-111, ACD-109, ACD-110, ACD-100, ACD-105, ACD-106) — see
   git history for earlier handoff versions if needed.
