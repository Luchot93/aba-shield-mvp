# Session Handoff

_Last updated: 2026-10-14_

## 1. Goal we are moving towards

This session closed out the full ACD-99 chain: flip `FLAGS.PIPELINE`/`FLAGS.STAFF`
to launch Pipeline CRM and Staff Directory for real, then clear the two
follow-up tickets that triage surfaced (stale test assertions, app-wide
color-contrast debt) so nothing shipped half-verified. All three are now
merged to `main` and closed in Jira.

**Status: ACD-99, ACD-116, and ACD-117 are all done — merged to `dev` and
`main`, CI green on every PR, Jira tickets commented and transitioned to
Done.** There is no in-flight ticket right now; the next session starts
from backlog (see §5).

## 2. Current state of the code

**All changes from this session are merged into `main` (and `dev`). Nothing
outstanding on any feature branch. No DB/migration changes this session.**

- **ACD-99** (PR #146, merged to `dev` then promoted to `main`): flipped
  `FLAGS.PIPELINE`/`FLAGS.STAFF` to `true`. Fixed E2E mock-backend gaps in
  `src/lib/db.js`, `src/lib/e2e/store.js`, `src/lib/e2e/mockSupabase.js`
  that only became reachable once the flags were live. Fixed 2 critical
  axe violations (`label` on Client Detail checklist inputs, `select-name`
  on Staff Directory's sort dropdown) with `aria-label` additions. Updated
  `CLAUDE.md` to reflect Pipeline/Staff as shipped. Full diagnosis/fix
  record in `docs/ACD-99-flag-flip-qa-report.md`.
- **ACD-116** (PR #147, merged to `dev` then promoted to `main`): repaired
  18 stale/incorrect assertions in `tests/pipeline.spec.js` that had never
  run before (previously `test.describe.skip`-gated behind the same
  flags). Root causes were all test-authoring debt (stale branding string,
  stale seed-data counts, wrong seed client IDs, a missing "Add to
  Pipeline" checkbox in test setup, a renamed field testid, 3 assertions
  that wrongly assumed `FLAGS.REAUTH` is on) — zero `src/` app code changed
  for this ticket, test-file-only fix. Full suite now 81/81 in that file.
- **ACD-117** (PR #148 → `dev`, PR #149 `dev` → `main`): app-wide WCAG AA
  color-contrast fixes. Darkened `teal-600`, `slate-400`/`500`, `red-500`
  globally in `tailwind.config.js` to the next official Tailwind shade.
  Added per-stage `chipBg` values in `stages.js` for the Client Detail
  stage stepper (white text needs a darker solid background than the
  `dot` accent color). Replaced a translucent `bg-white/20` count-badge
  pattern (Clients/Pipeline filter chips) with a solid white pill + dark
  teal text — the overlay washed out to ~2.8:1 regardless of underlying
  color. Fixed the amber-500 "Requested" status pill to amber-600. Opted
  two `NavBar.jsx` labels (inactive nav tabs, "Testing as:") out of the
  global `slate-400` override via a pinned literal hex, since that header's
  dark background already passed at the original lighter value and the
  darkened override broke it (~7.3:1 → ~3.9:1) — same token, two
  incompatible contexts, documented inline with a comment.
- **Verification across all three**: `tests/accessibility.spec.js` 6/6
  passing (0 critical/serious violations, Login/Clients/New Client
  form/Pipeline/Client Detail/Staff Directory), full Playwright suite 121
  passed / 59 skipped (pre-existing gated-feature tests, unrelated) / 0
  failed, `npm run build` succeeds, `npm audit --omit=dev --audit-level=high`
  0 vulnerabilities, manual visual spot-check — no regressions. Every PR's
  CI (build, playwright, rls, Vercel deploy) ran green before merging.
- **Repo sync verified clean**: local `dev` and `main` both fast-forwarded
  to match `origin`, a direct `git diff main dev` is empty (byte-for-byte
  identical), no stray local-only commits on any branch, working tree
  clean, no stash entries.
- **Jira**: ACD-99, ACD-116, ACD-117 each got a plain-English comment
  summarizing the work and linking the merging PR(s), then were
  transitioned to **Done**.

## 3. Files actively being edited

None — only `handoff.md` is being touched now, at session close. Nothing
is mid-edit; everything from this session is already committed and merged.

## 4. Everything tried that failed / walked back — and deferred items

- **Nothing walked back on the ACD-99 flag flip itself** — clean on the
  first pass (build succeeded, no orphaned flag checks found).
- **Stale accessibility test run during ACD-117 verification**: a re-run
  of `tests/accessibility.spec.js` after the `tailwind.config.js` edit
  still showed the old violations, because Playwright's
  `reuseExistingServer: !CI` was reusing a dev server process that
  predated the config edit (started before the session, serving stale
  compiled CSS). Fixed by killing the stale process and re-running — not
  an app bug, a local test-environment artifact.
- **Genuine regression introduced and self-caught during ACD-117**:
  globally darkening `slate-400` fixed contrast on light/white backgrounds
  but broke `NavBar.jsx`'s already-passing dark-header usage of the same
  class (same token, incompatible contexts — the second instance of this
  exact bug class this project has hit, after an earlier `SM.dot` issue).
  Caught via the probe script + manual WCAG contrast math before shipping,
  fixed with a pinned literal-hex opt-out rather than reverting the global
  change (see §2 above).
- **Deliberately scoped `color-contrast` out of ACD-99** rather than
  fixing it inline — it predated Pipeline/Staff (visible on Clients/New
  Client form too), so it was filed separately as ACD-117 instead of
  scope-creeping ACD-99. (Resolved this session, as described above.)
- **Test-suite debt found during ACD-99 but not fixed inline** — filed as
  ACD-116 instead, since full remediation was out of ACD-99's scope.
  (Resolved this session.)
- Temporary diagnostic scripts (`tests/a11y-probe.spec.js`, used in both
  the ACD-99 and ACD-117 triage passes) were deleted after use in each
  case — never part of the permanent test suite.

## 5. Next steps

No ticket is actively in progress. Backlog carried forward unchanged from
prior sessions (none of these were touched this session):

1. **ACD-115** (Tailwind/Vite major-version upgrade, from ACD-94) — still
   unstarted.
2. Carried over from ACD-92 — the follow-up re-test of `manage-staff`'s
   invite happy-path once Supabase's invite emails aren't rate-limited.
   Still unstarted.
3. **ACD-101** (DNS/Resend domain verification) — still To Do, unassigned,
   still blocked on owning/controlling a real domain. Unchanged.
4. The Login-page a11y test flakiness noted in the ACD-99 QA report
   (passed in isolation, failed once in a long combined run) — not
   investigated this session either; worth a look if it recurs.
5. Dependabot PR #137 (`@sentry/react` 10→11 major-version bump) merged to
   `main` previously, outside a session — still not re-verified against
   `sentry.js`'s API usage. Unchanged from prior handoffs.
6. Carried forward, unrelated pointer only (not reproduced here): the
   `openClientTab` Playwright helper bug, and everything from the ACD-82
   through ACD-98 handoffs' outstanding items (ACD-113, ACD-112, ACD-111,
   ACD-109, ACD-110, ACD-100, ACD-105, ACD-106) — see git history for
   earlier handoff versions if needed.
7. 4 open Dependabot dependency-bump PRs exist on the repo as of this
   session's close (#133 react-dom 18→19, #134 vite 5→8, #135
   @vitejs/plugin-react 4→6, #136 tailwindcss 3→4) — all major-version
   bumps, none reviewed or merged yet, likely overlapping with ACD-115's
   scope. Worth triaging together next session.
