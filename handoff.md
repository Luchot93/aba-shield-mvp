# Session Handoff

_Last updated: 2026-09-30_

## 1. Goal we are moving towards

[ACD-74](https://awcbehavioralhealth.atlassian.net/browse/ACD-74) — "B3: Fix a
leftover bug hiding clients from staff, and pull the Staff Directory from the
real database." Two fixes: (a) `getClients` was redundantly filtering by
`user_id` even though RLS (from [ACD-67](https://awcbehavioralhealth.atlassian.net/browse/ACD-67)
/ Prompt A1) already scopes visibility correctly at the database level; (b)
the Staff Directory was reading from `SEED_STAFF` mock data instead of the
real Supabase `staff` table. Write-side staff actions (Invite/Edit/Revoke/
Bulk Import) were explicitly out of scope — that's
[ACD-76](https://awcbehavioralhealth.atlassian.net/browse/ACD-76).

**Status: shipped, merged to `main`, and confirmed "Done" in Jira.** (An
earlier query this session showed the ticket still "In Progress"; a later
query confirmed it had since been transitioned to "Done" — no action needed.)

## 2. Current state of the code

**Merged to `main`, live in the sense that it will deploy on Vercel's next
build.**

- PR [#83](https://github.com/Luchot93/aba-shield-mvp/pull/83)
  `ACD-74-wire-staff-directory-and-fix-client-rls` → `dev` — merged.
- PR [#84](https://github.com/Luchot93/aba-shield-mvp/pull/84) `dev` → `main`
  — merged. Local `main`/`dev` fast-forwarded to match origin at session
  close.
- `src/lib/db.js` — removed `.eq('user_id', userId)` from `getClients` (RLS
  now handles visibility scoping); added `getStaff()` and `createStaff()`.
- `src/App.jsx`:
  - `staff` state now loads via `getStaff()` in a new `useEffect` (mirrors
    the existing `getClients` effect) instead of initializing from
    `SEED_STAFF`.
  - Added a module-level `toInitials(name)` helper (mirrors the existing
    local one in `BulkInvitePanel.jsx` — deliberately not extracted to a
    shared utils module; only two usages, would be premature abstraction).
  - `enrichedStaff` now computes `initials: s.initials || toInitials(s.name)`
    — the real Supabase `staff` table has no `initials` column, so without
    this every real staff member's avatar would render blank across
    Pipeline, Clients, Assessments, and Client Detail views.
  - `SEED_STAFF` import kept — still used by two other live call sites
    unrelated to this ticket (the `FLAGS.PIPELINE`-gated seeding effect, and
    an ungated effect that auto-creates assessment sessions for
    assessment-stage clients).
- `FLAGS.STAFF` confirmed still `false` in committed code. It was flipped to
  `true` locally/uncommitted to QA the Staff Directory in a browser, then
  reverted before committing — confirmed via `git diff` showing zero change
  to `featureFlags.js` post-revert.
- Verified via `npx vite build --logLevel warn` — clean, only the same
  pre-existing unrelated warnings documented in prior handoffs.
- **Live browser QA actually completed this time** (not just a code trace)
  at `localhost:5175` with `FLAGS.STAFF` temporarily on: Staff Directory
  shows the real Supabase record ("Luis Teran / ADMIN / Active") with
  correctly computed initials "LT"; Clients page loads all 7 real clients via
  the RLS-scoped query; Assessments page renders against `enrichedStaff`
  with no console errors anywhere. **User confirmed this read-side QA pass
  as complete — no longer carried forward as a to-do** (the formal flag flip
  itself is still deferred; see Next Steps).
- The E2E GitHub Actions check on PR #84 ran unusually slow (~6m46s vs. the
  normal ~33s) specifically on the `npx playwright install --with-deps
  chromium` step. Diagnosed as transient CI runner/network variance, not
  caused by this PR — `.github/workflows/e2e.yml` has no cache for the
  Playwright browser binary, so every run re-downloads it from scratch. The
  check passed once that step finished. Filed as
  [ACD-107](https://awcbehavioralhealth.atlassian.net/browse/ACD-107).
- Posted a plain-English comment to both ACD-74 and ACD-76 documenting the
  scope split (killing `SEED_STAFF` is ACD-74; write-side Invite/Edit/
  Revoke/Bulk Import wiring is ACD-76) — confirmed with the user that no new
  ticket was needed since ACD-76 already covers the write side.
- Posted a plain-English comment to ACD-74 documenting the `initials`
  fallback addition (found mid-session as a gap, pulled into this ticket's
  scope with the user's explicit approval rather than filed separately).
- **New standing rule established this session:** whenever a pending/
  unresolved item is identified in a handoff review, check Jira for an
  existing covering ticket first; if none exists and it isn't being fixed
  in the current session, create a new Jira ticket for it. Applied
  immediately below — filed
  [ACD-105](https://awcbehavioralhealth.atlassian.net/browse/ACD-105)
  (ACD-69 frontend wiring),
  [ACD-106](https://awcbehavioralhealth.atlassian.net/browse/ACD-106)
  (CLAUDE.md staleness), and
  [ACD-107](https://awcbehavioralhealth.atlassian.net/browse/ACD-107)
  (Playwright CI caching) for the three items from last session's debt list
  that had no existing ticket.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync. Working tree is clean. Next session starts
from a clean slate.

## 4. Everything tried that failed / walked back

- Considered flipping `FLAGS.STAFF` to `true` as part of this ticket —
  explicitly declined by the user ("Got it then no flipping for now"). Only
  flipped locally and temporarily (uncommitted) for browser QA, then
  reverted.
- Considered extracting `toInitials` into a shared/exported utils module
  since a local copy already existed in `BulkInvitePanel.jsx` — decided
  against it as premature abstraction for a two-usage helper; added a
  second local copy in `App.jsx` instead, matching the existing pattern.
- **Carried from the ACD-73 session, still true:** the `SEED_CLIENTS`
  missing-import crash ([ACD-103](https://awcbehavioralhealth.atlassian.net/browse/ACD-103))
  was fixed locally then reverted per a "revert to before we began testing"
  instruction — the bug is still present in the committed codebase. Not
  touched this session either; the user explicitly said to finish ACD-74
  first and return to it next ("Lets first fix the ticket then we can return
  to the seed_client bug").
- **Carried from the ACD-73 session, still true:** the "Add to pipeline"
  no-persistence bug ([ACD-104](https://awcbehavioralhealth.atlassian.net/browse/ACD-104))
  — `db.js` has no `updateClient` function at all. Not touched this session.

## 5. Next steps

1. **[ACD-103](https://awcbehavioralhealth.atlassian.net/browse/ACD-103)** —
   fix the `SEED_CLIENTS` missing-import crash in `src/App.jsx`. This is the
   explicit next thing the user asked to return to, per this session's own
   sequencing decision. Must be fixed before `FLAGS.PIPELINE` is ever flipped
   to `true` for real.
2. **[ACD-104](https://awcbehavioralhealth.atlassian.net/browse/ACD-104)** —
   fix the "Add to pipeline" no-persistence bug (`handleAddToPipeline` only
   updates local state; `db.js` has no `updateClient` at all). Blocks real
   Pipeline QA/rollout.
3. **[ACD-76](https://awcbehavioralhealth.atlassian.net/browse/ACD-76)** —
   write-side Staff wiring (Invite/Edit/Revoke/Bulk Import against real
   accounts). Confirmed by the user as the natural next ticket after
   ACD-74's read-side wiring; not started.
4. **Manual QA for ACD-73** — still not done (confirm no Session Log/
   Reassessment tabs appear anywhere in the Services stage, no console
   errors, other Services-stage functionality still works). **User: wait
   until the `FLAGS.PIPELINE` flip to run this check.** Carried forward.
5. **[ACD-105](https://awcbehavioralhealth.atlassian.net/browse/ACD-105)**
   (new this session) — wire ACD-69's denial-tracking and staff-contact
   columns (backend already Done) into the actual frontend UI. Not started.
6. **[ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100)**
   (wire documents to real Supabase storage + table) — not started.
   **User: wait until the `FLAGS.PIPELINE` flip to test this.**
7. **[ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)**
   (Resend domain verification) — still blocked on DNS access to a real
   domain; per the user, pending leadership's help to unblock. Carried
   forward.
8. **[ACD-90](https://awcbehavioralhealth.atlassian.net/browse/ACD-90)**
   ("E1: Add automated tests proving staff can only see their own data") —
   still unblocked-but-pending. **User: wait until the `FLAGS.PIPELINE` flip
   to test this.**
9. **[ACD-106](https://awcbehavioralhealth.atlassian.net/browse/ACD-106)**
   (new this session) — CLAUDE.md's "What This Repo Is NOT" section is stale
   on the Pipeline/Trench-5 exclusion now that ACD-67 and ACD-69 backend prep
   are Done. Not started.
10. **Manual QA against the ACD-67 acceptance criteria** — still outstanding
    as an action item even though the Jira ticket itself shows "Done."
    **User: wait until the `FLAGS.PIPELINE` flip to confirm this.**
11. **[ACD-107](https://awcbehavioralhealth.atlassian.net/browse/ACD-107)**
    (new this session) — `.github/workflows/e2e.yml` has no cache for the
    Playwright browser binary, causing one CI run to take ~7 minutes on the
    install step alone this session. Not started.
12. **Flip `FLAGS.STAFF` to `true` for real** — still explicitly deferred by
    the user. The read-side behavior was validated working in this session's
    browser QA (temporary local flag flip, since reverted — see Section 2),
    so the formal flip itself is the only remaining step, expected to happen
    alongside/after the `FLAGS.PIPELINE` flip. Once flipped for real, do a
    manual Invite → Edit → Revoke pass to confirm all three round-trip
    through Supabase correctly.
