# Session Handoff

_Last updated: 2026-10-09_

## 1. Goal we are moving towards

ACD-93 ("E4: Add automated browser tests for role restrictions and file
upload validation") — add real-browser (Playwright) coverage, not just unit
tests, for: (a) role-based access scoping (admin vs. BCBA vs. RBT — who sees
which clients/pages/actions), and (b) `src/utils/validateFile.js`'s upload
guards (MIME allowlist, max size, magic-number content sniffing) on every
surface that calls it.

**Status: DONE, tested, and merged to `main` — deployed to production.**

- PR [#126](https://github.com/Luchot93/aba-shield-mvp/pull/126)
  (`ACD-93-role-restriction-browser-tests` → `dev`) merged.
- PR [#127](https://github.com/Luchot93/aba-shield-mvp/pull/127)
  (`dev` → `main`) merged.
- Local `main` and `dev` fast-forwarded to origin this session.

## 2. Current state of the code

**Committed, merged into `dev` and `main`. No DB/backend changes — this
ticket is test-only, so nothing to deploy to Supabase.**

- **New `tests/security-permissions.spec.js`**: live block proves Clients-
  page role scoping (admin sees every client; BCBA/RBT only see their own
  assigned clients; the restriction is server/data-side — a restricted
  client never reaches the DOM, confirmed via `toHaveCount(0)`, not just
  visually hidden). Three `gated()` blocks (Staff/Metrics/Pipeline role
  restrictions) are written and registered now but `.skip`ped since those
  flags are off — they auto-activate the moment a flag flips, no extra work
  needed then.
- **New `tests/upload-validation.spec.js`**: live block adds the
  *rejection*-path tests (wrong MIME, oversized, content/type mismatch via
  magic-number sniffing) for ImportPanel that `tests/import.spec.js` never
  had (that file only proved the valid-CSV happy path). Three more `gated()`
  blocks cover BulkInvitePanel, ClientDetailPage's `file_upload` checklist
  items, and ReassessmentCyclePanel's final-report upload — same pattern,
  same auto-activate-on-flag-flip behavior.
- **`src/lib/e2e/mockSupabase.js` + `src/lib/e2e/store.js` +
  `tests/helpers/auth.js`**: extended the E2E mock backend with
  `loginAsBCBA`/`loginAsRBT` (new `E2E_BCBA`/`E2E_RBT` test accounts, ids
  `u2`/`u4` matching `seedData.js`'s staff fixtures) and made
  `store.listClients()` role-aware (`isAdmin || bcba_id === userId ||
  rbt_id === userId`), mirroring the real ACD-67 RLS policy instead of the
  old `user_id`-ownership stub. `getProfileFor()` now returns real seeded
  names (Dr. Ana Reyes / James Torres) instead of a generic "E2E User" for
  these two ids.
- **`playwright.config.js`**: added `workers: 1`, permanently. Root cause:
  parallel workers all hit the dev server's cold-start/first-compile window
  with `page.goto` simultaneously, reliably timing out `beforeEach` hooks
  across *unrelated, pre-existing* spec files too (not a defect introduced
  by the new tests) — reproduced identically on `auth.spec.js`,
  `clients.spec.js`, `assessment.spec.js`, `import.spec.js`. Serializing
  removed the race entirely.

### QA / verification performed

- Full suite, `npx playwright test` (now serialized by the config change):
  **17 passed, 157 skipped, 0 failed**. The 157 skipped are every
  `gated()`-wrapped test across the whole suite (not just this ticket's) —
  confirmed as "registered but off," not silently missing.
- Confirmed the role-scoping restriction is enforced server/data-side, not
  a client-side filter a search box could route around (`BCBA cannot
  surface another BCBA's client through search` test).
- Cross-referenced `checklist.js`'s per-stage `file_upload` items against
  `seedData.js`'s client stage/`bcba_id`/`rbt_id` assignments before writing
  the ClientDetail tests — found no RBT-assigned client sits at a stage
  with a `file_upload` item, so that surface is deliberately BCBA-only
  coverage rather than a fabricated/unreachable RBT case.

## 3. Files actively being edited

None — everything is committed, pushed, merged into `dev` and `main`. Only
this file (`handoff.md`) is being touched now.

## 4. Everything tried that failed / walked back — and deferred items

- **Parallel Playwright workers — root-caused, not walked back, now fixed
  permanently:** first full-suite run (default parallel workers) produced
  12 `page.goto` timeout failures. Investigated a stray leftover Node
  process on port 5199 first (killed it), but the same 12 failures
  reproduced again afterward — confirming it was a genuine worker-count
  race against the dev server's cold start, not stale state. Verified with
  `--workers=1` (clean pass), then made that permanent in
  `playwright.config.js` rather than leaving it as a one-off flag future
  sessions would have to rediscover.
- **No RBT-assigned client for `ClientDetailPage` upload tests:** every
  client with `rbt_id: u4` (c8/c9/c10) sits at a Pipeline stage
  (`authorized`/`staffing`/`services`) that has zero `file_upload`
  checklist items per `checklist.js`. Rather than inventing an unreachable
  test case, that surface's upload-validation coverage is BCBA-only
  (client c1, stage `intake`). Not a gap worth a new ticket — it's a
  property of the seeded fixtures, and the same `validateFile.js` boundary
  is already covered end-to-end via BCBA.
- None this session — ACD-93 shipped clean, no walked-back requirements.

Jira ACD-93 has been commented with the full implementation/test summary
and **transitioned to Done** (resolved this session — no longer pending).

## 5. Next steps

1. The now-merged `ACD-93-role-restriction-browser-tests` branch (local +
   `origin`) is safe to delete post-merge whenever convenient — unlike
   `dev`/`main`, it's disposable. Not deleted automatically since that's a
   destructive action outside what was explicitly asked.
2. Carried over from ACD-92's handoff, still unstarted — **the follow-up
   re-test of `manage-staff`'s invite happy-path** once this Supabase
   project's invite emails aren't rate-limited (commented on ACD-92
   already, not a new ticket).
3. **ACD-101** (DNS/Resend domain verification) — still To Do, unassigned,
   still blocked on owning/controlling a real domain. Unchanged.
4. This sprint's actual stated focus (per user, 2026-10-08, carried over
   across the last two sessions) is still **Staff, CRM Pipeline + new
   service checklist, and the standalone service session logs feature** —
   none of that has been touched in either the ACD-92 or ACD-93 sessions;
   fully unstarted from here. ACD-93's browser tests for those surfaces are
   written and gated/ready, but the features themselves are not built.
5. Carried forward, unrelated to ACD-92/ACD-93 (pointer only, not
   reproduced here): the `openClientTab` Playwright helper bug, and
   everything from the ACD-82 through ACD-91 handoffs' outstanding items
   (ACD-113, ACD-112, ACD-111, ACD-109, ACD-110, ACD-100, ACD-105, ACD-106,
   ACD-99, the `FLAGS.PIPELINE` flip-gated QA items, and the
   `suggestFromLabel` fallback note) — see git history for earlier handoff
   versions if needed.
