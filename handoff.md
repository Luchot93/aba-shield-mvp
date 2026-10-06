# Session Handoff

_Last updated: 2026-10-06_

## 1. Goal we are moving towards

ACD-84 ("D7: Require all Authorized-stage fields, and let RBTs actually be
assigned directly from the pipeline board at this stage") — make every
Authorized-stage checklist field required (no optional fields on that
stage, per the PRD) and fix a bug where the RBT assignment control was
missing from the Kanban card at the Authorized stage.

**Status: DONE. Implementation complete, QA-verified live in the browser
against a real client fixture, merged into `dev` via PR
[#106](https://github.com/Luchot93/aba-shield-mvp/pull/106), and promoted to
`main` via PR [#107](https://github.com/Luchot93/aba-shield-mvp/pull/107).
Both merged; local `dev`/`main` fast-forwarded to match origin. Jira ACD-84
has a plain-English closeout comment and has been transitioned to Done.**

## 2. Current state of the code

**Migration: live in Supabase, committed to git.**
`supabase/migrations/20261006150413_acd84_authorized_stage_fields.sql` adds
5 real columns to `clients`: `schedule_template`, `scheduled_hours_week`,
`scheduled_97155_week`, `scheduled_97156_week`, `session_location`.

**Code changes — committed (migration + 5 modified files, commit
`4c25274`):**

- `src/constants/checklist.js` — the 5 Authorized-stage fields
  (`schedule_template`, `scheduled_hours_week`, `scheduled_97155_week`,
  `scheduled_97156_week`, `session_location`) are now required `form_field`
  items wired to the new real columns (previously some were optional /
  placeholder-only). `scheduled_hours_week` / `_97155_week` / `_97156_week`
  each carry an `authorizedHoursWeek` tag (`'97153'`/`'97155'`/`'97156'`)
  used by the pre-existing Stage 5→7 soft pre-fill — untouched by this
  change, confirmed still reading from the separate
  `client.authorized_97155`/`authorized_97156` fields, not the new columns.
  `session_location` also carries an `authorizedKey:'session_location'` tag
  consumed by the Staffing-stage field's cross-stage pre-fill — confirmed
  it now correctly reads the real column instead of a stub.
- `src/features/pipeline/components/KanbanCard.jsx` — **the core bug fix.**
  `showRBT` guard changed from `stage === 'staffing' || stage === 'services'`
  to also include `stage === 'authorized'`, so the RBT assignment control
  (shared `AssigneeButton`/`AssigneeDropdown`, same component BCBA already
  uses) now renders on the Kanban card at the Authorized stage. Confirmed
  scoped exactly — no other stages (`intake`, `auth_assessment`,
  `assessment`, `plan_draft`, `submitted`, `denied`) affected.
- `src/features/detail/ClientDetailPage.jsx` — downstream read-sites for
  the new fields re-pointed at the real columns (`authSched`, `authLoc`,
  `staffSched`, `staffLoc` around lines 1507-1510; `authorizedKey`
  consumption around line 775-776).
- `src/constants/seedData.js` — minor seed adjustments to keep the new
  required fields consistent for seeded clients.
- `src/constants/featureFlags.js` — **not committed with a diff.**
  `FLAGS.PIPELINE` was temporarily flipped to `true` locally to reach the
  Kanban/detail UI for QA, then reverted to `false` before commit — `git
  diff src/constants/featureFlags.js` showed zero output, confirming the
  flag is correctly `false` in the repo baseline (same pattern as the
  ACD-83 session).
- Verified with a full `npm run build` — succeeds, no new errors.

### QA verification (this session, live browser pass against localhost:5175)

**Fixture setup (via Supabase MCP `execute_sql`, user-approved, same
pattern as ACD-83's Sally Mae precedent):**
- **John Smith** (`a43342f5-d635-455e-a933-3f89a8d9d8ee`) moved via a
  scoped SQL `UPDATE` from his prior staged stage into `authorized`.
- A new **`QA Test RBT`** staff row was inserted via SQL with a
  `cert_expiry` far enough in the future to be assignable (not expired).

**Acceptance criteria verification:**
1. **Required fields gate stage completion.** Before this change, the
   Authorized-stage checklist completion count was 3/11 with the 5 target
   fields optional/skippable. After making them required `form_field`s,
   completion correctly dropped to reflect them as outstanding, then
   climbed back to the full count only once all 5 were actually filled in
   through the UI (confirmed field-by-field: `schedule_template`,
   `scheduled_hours_week`, `scheduled_97155_week`, `scheduled_97156_week`,
   `session_location` all save and are reflected in the completion count).
2. **RBT assignable from the board at Authorized.** Confirmed the RBT row
   now renders on John Smith's Kanban card at the Authorized stage, the
   dropdown opens, lists RBT staff (including the new `QA Test RBT`), and
   assignment persists after a hard reload.

**Regression check (explicitly requested by the user — "confirm every
acceptance criteria and nothing else breaks"):**
- Re-read `KanbanCard.jsx`'s `showRBT` guard to confirm it only gained
  `authorized` and didn't accidentally loosen scope for any other stage.
- Noticed the dropdown disables/greys out any RBT whose `cert_expiry` is
  null or in the past (`AssigneeDropdown.jsx`'s `expired` check). Read the
  source directly rather than assuming a bug: this is pre-existing,
  intentional `rbt_cert_valid` hard-block logic, explicitly out of scope
  for ACD-84 — not a regression introduced by this change.
- Confirmed the `authorizedHoursWeek` pre-fill chain
  (`client.authorized_97155`/`authorized_97156`, consumed in
  `ClientDetailPage.jsx` ~lines 768-770, 911-919) is a separate,
  pre-existing mechanism from the new `scheduled_*_week` columns, and is
  unaffected by this change.
- Full `npm run build` clean.

**Decision: John Smith's live Supabase row and the new `QA Test RBT` staff
row are intentionally left in their post-QA state** (staged at
`authorized`, all 5 new fields filled, RBT assigned) — per explicit user
instruction ("leave them we can use them for testing"), to reuse as
fixtures for testing later pipeline stages rather than reverting them.

### Jira / PR closeout

- PR [#106](https://github.com/Luchot93/aba-shield-mvp/pull/106)
  (`ACD-84-authorized-stage-fixes` → `dev`) merged.
- PR [#107](https://github.com/Luchot93/aba-shield-mvp/pull/107)
  (`dev` → `main`) merged.
- Local `main` fast-forwarded `3dfbf1c..cc3de1d`; local `dev`
  fast-forwarded `4ecd9fd..5ca1d7e` — both confirmed synced with origin.
- Jira ACD-84: plain-English closeout comment posted (what shipped, what
  was tested, PR links) and ticket transitioned to **Done**.

## 3. Files actively being edited

None — all ACD-84 edits are applied, QA-verified, committed, and merged
into both `dev` and `main`. Only this file (`handoff.md`) is being touched
now, to close out the session record.

## 4. Everything tried that failed / walked back — and deferred items

- No approaches were walked back this session.
- One minor browser-automation hiccup (not a code bug): while filling the
  5 Authorized-stage fields one at a time in the live QA pass, saving
  `schedule_template` shifted the page layout down (a "Current: ..."
  confirmation line was added), which caused the next click/type for
  `scheduled_hours_week` to briefly land on stale coordinates. Caught via
  a fresh screenshot, corrected, and re-verified saved. No code or design
  change resulted from this — purely a QA-tooling correction.
- No new deferred/flagged-but-not-ticketed items identified this session.

## 5. Next steps

1. ~~PR from `ACD-84-authorized-stage-fixes` into `dev`~~ — merged
   ([#106](https://github.com/Luchot93/aba-shield-mvp/pull/106)).
   ~~Promote `dev` to `main`~~ — merged
   ([#107](https://github.com/Luchot93/aba-shield-mvp/pull/107)).
   ~~Move the ACD-84 Jira ticket to Done with a session-summary
   comment~~ — done, comment posted in plain English, ticket transitioned
   to Done.
2. When picking up the next stage of pipeline work, remember **John Smith**
   (`a43342f5-d635-455e-a933-3f89a8d9d8ee`) is now staged through
   Authorized with all 5 new scheduling fields filled in and an RBT
   (`QA Test RBT`) assigned — reuse as a fixture rather than creating a
   fresh test client. The `QA Test RBT` Supabase staff row is also
   intentionally left in place (non-expired `cert_expiry`) as a reusable
   assignable-RBT fixture.
3. File Jira tickets for the 3 deferred REAUTH/REASSESSMENT repoint spots
   in `ClientDetailPage.jsx` (noted in the ACD-82 handoff) **only when
   that work actually starts** — per the user, still just a handoff note,
   no tickets yet.
4. Everything from the ACD-82/ACD-83 handoffs' carried-forward "Next
   steps" list (ACD-111, ACD-101, ACD-109, ACD-110, ACD-100, ACD-105,
   ACD-90, ACD-106, ACD-99, the `FLAGS.PIPELINE` flip-gated QA items,
   branch cleanup, and the `suggestFromLabel` fallback note) is still
   outstanding and unrelated to ACD-84 — carried forward as-is, not
   reproduced here in full; see git history for the 2026-10-06 (ACD-83)
   version of this file if needed.
