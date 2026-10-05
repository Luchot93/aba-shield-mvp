# Session Handoff

_Last updated: 2026-10-05_

## 1. Goal we are moving towards

[ACD-82](https://awcbehavioralhealth.atlassian.net/browse/ACD-82) ("D5") —
require all authorization proof fields at the Submitted stage, catch invalid
auth period date ranges (end before/equal to start), and flag cases stuck
waiting on the payer's response.

**Status: DONE. Implementation complete, QA-verified live in the browser,
merged into `dev` via PR #101, and promoted to `main` via PR #102. Both
merged; local `dev`/`main` fast-forwarded to match origin.**

## 2. Current state of the code

**Migration: live in Supabase, committed to git.**
`supabase/migrations/20261005204600_acd82_submitted_auth_fields.sql` was
applied via the Supabase MCP (`apply_migration`, project
`qravuejkiluimaihhbrf`) and confirmed in the ledger via `list_migrations` at
the assigned version `20261005204600`. The local file matches that version
exactly. It adds 7 columns to `clients` (`plan_submission_date`,
`auth_reference_number`, `authorized_97153/97155/97156`, `auth_start_date`,
`auth_end_date`) plus a check constraint
(`auth_end_date IS NULL OR auth_start_date IS NULL OR auth_end_date > auth_start_date`).

**Code changes — committed (migration + 5 modified files):**

- `src/constants/checklist.js` — the 7 Submitted-stage `form_field` items
  (`plan_submission_date`, `auth_reference_number`, `authorized_97153/55/56`,
  `auth_start_date`, `auth_end_date`) are now required (`optional:true`
  removed) and wired via `clientField` to the new real columns instead of
  local-only checklist state. `mkChecklist().submitted` trimmed to just
  `plan_submitted`, `cpt_units_requested`, `approval_uploaded` (the fields
  that stay local/non-`clientField`). `auth_end_date` got
  `afterField:'auth_start_date', afterFieldLabel:'start date'` for the new
  date-order check.
- `src/utils/checklist.js` — `itemComplete`'s `form_field` case now validates
  `afterField` (end date must be strictly after the referenced field,
  mirroring the existing stale-date convention). `planDraftHours` auto-check
  repointed from `client.checklist?.plan_draft?.hours_*` to
  `client.hours_97153/55/56` directly.
- `src/features/detail/ClientDetailPage.jsx` — repointed every live read of
  `client.checklist.submitted.*` to the new real columns: `doAdvance`'s
  auth-expiry copy-on-advance, both `authorizedHoursWeek` autoDefault/hint
  reads, and the Auth Summary banner (shown in the Authorized stage). Added
  inline red-border + "⚠ End date must fall after the start date" warning UI
  for `auth_end_date`, mirroring the existing stale-date pattern. Fixed an
  adjacent pre-existing bug found during review: the `item.planDraftKey`
  autoDefault read was still pointing at the dead
  `client.checklist?.plan_draft?.[key]` path (left over from the ACD-81
  migration that moved those fields to real columns) — now reads
  `client[item.planDraftKey]` directly. `doReturnFromDenied` (Mark as
  Denied → return flow) rewritten to snapshot/clear the 7 real columns
  (`SUBMITTED_AUTH_CLIENT_FIELDS`) separately from the 1 local field that
  stays in checklist state (`approval_uploaded`), and now actually persists
  the cleared client columns to Supabase via `updateClient` (previously the
  local checklist clear was never persisted at all).
- `src/features/pipeline/components/KanbanCard.jsx` — new "Waiting on payer"
  badge (Kanban card only, not `ClientDetailPage`): shows when
  `stage === 'submitted'` and `plan_submission_date` is more than 14 days
  ago and `auth_start_date` is still null. Client-side computed, no new
  columns needed. Comment flags the 14-day threshold as a flat default that
  may need to become payer/plan-specific later.
- `src/constants/seedData.js` — all 5 `cl.submitted = {...}` seed blocks
  (clients c10, c11, c15, c16, c17) split: the 7 now-real fields moved to
  top-level `c.*` assignments, `cl.submitted` trimmed to
  `{ plan_submitted:true, approval_uploaded:true }`.
- "Mark as Denied" button scope left unchanged (still `submitted` /
  `auth_assessment` only) — added a one-line comment noting the PRD calls
  for wider scope; not part of ACD-82.
- `plan_submitted` and `approval_uploaded` checklist items left untouched, as
  scoped.
- Verified with a full `npm run build` — succeeds, no new errors (only
  pre-existing chunk-size/Tailwind-content warnings).

### QA verification (this session, live browser pass against localhost:5175)

`FLAGS.PIPELINE` was temporarily flipped to `true` locally to reach the
Kanban/detail UI (ACD-82's surfaces all live behind it), verified, then
reverted to `false` before commit — confirmed via `git diff` showing no
diff on `featureFlags.js`. Test client: John Smith (real Supabase row,
`id a43342f5-d635-455e-a933-3f89a8d9d8ee`), moved to the Submitted stage via
a one-off SQL `UPDATE` (user-approved) since no seed client was at that
stage. All 5 behaviors confirmed working correctly:

1. All 7 required fields render, save, and are wired to the real columns.
2. Date-order validation: red border + "⚠ End date must fall after the
   start date" on an invalid end date; clears correctly once corrected.
3. Authorization Summary banner (Authorized stage) pulls live from the real
   columns (`Auth # AET-SUB-0001`, `Period Oct 5, 2026 → Apr 5, 2027`,
   `97153 20h · 97155 4h · 97156 4h`) — briefly flipped John Smith's `stage`
   to `authorized` via SQL to view it, then reverted back to `submitted`.
4. `authorizedHoursWeek` hint computes correctly from the new columns
   (monthly ÷ 4 → weekly default, e.g. `20h/mo → ~5h/wk`).
5. Kanban "Waiting on payer" badge renders correctly ("Waiting on payer —
   34d since submission") when `auth_start_date` is null and
   `plan_submission_date` is >14 days old.

**Decision: John Smith's live Supabase row is intentionally left in its
post-QA state** (`pipeline_entry: true`, `stage: 'submitted'`, all 7 auth
fields populated with test values, plus Staffing-stage scheduled-hours
fields) — per explicit user instruction, to reuse as the fixture for testing
later pipeline stages once those changes land, rather than reverting it.

### Scope boundary decided this session

Fix everything in the active CRM build, including seed data — this covers
all non-gated code, **including** code behind `FLAGS.PIPELINE` (that's the
active CRM epic, not deferred Phase-2 code). The only things deferred are
the specific `FLAGS.REAUTH` / `FLAGS.REASSESSMENT`-wrapped code paths, since
reauth/reassessment aren't being worked this sprint (scope is "through the
Services stage of a client's first pass"). See section 4 below for the exact
3 spots.

## 3. Files actively being edited

None — all ACD-82 edits are applied, QA-verified, committed, and merged into
both `dev` and `main`. Only this file (`handoff.md`) is being touched now,
to close out the session record.

## 4. Everything tried that failed / walked back — and deferred items

- No failed approaches this session — the Read-tool chunking issue on
  `ClientDetailPage.jsx` (file too large for a single `Read`) was a tooling
  hiccup, not a design walk-back; fixed by reading in targeted
  `offset`/`limit` chunks.
- Scope framing was corrected once: treating the whole CRM/Pipeline section
  as "gated" (since it sits behind `FLAGS.PIPELINE`) was wrong — the user
  corrected this, since `FLAGS.PIPELINE` is the active epic being un-gated,
  not deferred Phase-2 code. Only `FLAGS.REAUTH` / `FLAGS.REASSESSMENT`
  paths are genuinely out of scope this sprint.
- QA setup required two one-off SQL mutations against live Supabase data
  (moving John Smith through `submitted` → briefly `authorized` → back to
  `submitted`), both explicitly user-approved before execution. The
  resulting test data on John Smith's row was deliberately **not** reverted
  — see "Decision" note in section 2.

**Deferred — flagged per user instruction, not filed as new Jira tickets
yet.** These 3 spots in `ClientDetailPage.jsx` still read
`client.checklist.submitted.*` instead of the new real columns added by
this migration. They don't affect the current first-pass new-client flow
(the surrounding code doesn't execute while the flags are off, and
conceptually only matters for renewal/reassessment cycles) — each now has an
inline comment pointing back here:
1. Reauth countdown banner, Services-stage header area (`FLAGS.REAUTH &&
   client.stage === 'services'`) — reads `auth_end_date`.
2. Reauth countdown banner, Services tab panel header (`FLAGS.REAUTH`,
   unconditional once inside the services tab render) — reads
   `auth_end_date` (falls back to `auth_expiry_date`).
3. Reassessment tab block (`FLAGS.REASSESSMENT && servicesTab ===
   'reassessment'`) — reads `auth_end_date` (urgency window calc) and, in a
   nested snapshot-on-cycle-close handler, `authorized_97153/55/56`,
   `auth_start_date/end_date`, `auth_reference_number`.

**When Reauth/Reassessment is actually built**, repoint all of the above to
the real columns from this migration (same pattern already applied
elsewhere in this file) — do this fix to the gated code at that time rather
than ad-hoc now.

## 5. Next steps

1. ~~PR from `ACD-82-submitted-stage-auth-proof-required` into `dev`~~ —
   merged (#101). ~~Promote `dev` to `main`~~ — merged (#102). ~~Move the
   Jira ticket to Done~~ — done, with a session-summary comment (what was
   built, QA results, blockers, both PR links). ACD-82 is fully closed out.
2. File Jira tickets for the 3 deferred REAUTH/REASSESSMENT repoint spots
   **only when that work actually starts** — per the user, no new tickets
   for them right now, just this handoff note.
3. When picking up the next stage of pipeline work, remember John Smith
   (`a43342f5-d635-455e-a933-3f89a8d9d8ee`) is already staged through
   Submitted with real auth data filled in — reuse him rather than creating
   a fresh test client.
4. Everything from the prior (ACD-81) handoff's "Next steps" list (ACD-111,
   ACD-101, ACD-109, ACD-110, ACD-100, ACD-105, ACD-90, ACD-106, ACD-99, the
   `FLAGS.PIPELINE` flip-gated QA items, branch cleanup, and the
   `suggestFromLabel` fallback note) is still outstanding and unrelated to
   ACD-82 — carried forward as-is, not reproduced here in full; see git
   history for the 2026-10-02 version of this file if needed.
