# Session Handoff

_Last updated: 2026-10-01_

## 1. Goal we are moving towards

[ACD-79](https://awcbehavioralhealth.atlassian.net/browse/ACD-79) ("D2") —
at the Auth/Assessment stage, "Authorization submitted to insurer" and "CPT
97151 authorization received" were satisfiable by a bare checkbox, with no
real proof the submission actually happened. Add typed fields (ROI
confirmation, reference number, submission date, submission method, units
requested/approved, auto-suggested expected response date) and require them
before the checklist counts those items as complete. Also fixes a bug where
staff could assign a BCBA to a client still at Intake, before that's
supposed to be allowed.

**Status: shipped, merged to both `dev` and `main`. Ticket moved to Done.
Session closed.**

## 2. Current state of the code

**Merged to `dev` (PR [#95](https://github.com/Luchot93/aba-shield-mvp/pull/95))
and promoted to `main` (PR
[#96](https://github.com/Luchot93/aba-shield-mvp/pull/96)).** Local `main`
and `dev` fast-forwarded to match origin at session close; both branches are
in sync.

- **Migration** `supabase/migrations/20261001190000_client_cpt97151_auth_fields.sql`
  — applied live to Supabase via MCP and committed. Adds
  `cpt97151_submission_date`, `cpt97151_reference_number`,
  `cpt97151_submission_method`, `cpt97151_units_requested`,
  `cpt97151_expected_response_date`, `cpt97151_units_approved` (with a
  `> 0` check) to `public.clients`. Purely additive, all nullable.
- `src/constants/checklist.js` — Auth/Assessment stage items: new
  `clientField`-backed form fields for submission date, reference number,
  submission method (select), units requested, expected response date
  (`suggestFromField: cpt97151_submission_date`, `suggestOffsetDays: 7`,
  `suggestFromLabel: 'submission date'`), and units approved. The
  pre-existing `appeal_deadline` item also gained `suggestFromLabel: 'denial
  date'` so the suggest-button text names its actual source field instead
  of being hardcoded.
- `src/utils/checklist.js` — `itemComplete()`: `auth_submitted` now requires
  the checkbox AND `roi_confirmed === true` AND a non-blank
  `cpt97151_reference_number` AND `cpt97151_submission_date`.
  `cpt_97151_received` now requires the checkbox AND
  `cpt97151_approval_doc === true`. Both were previously satisfied by the
  bare checkbox alone.
- `src/features/detail/ClientDetailPage.jsx` — two fixes: (1) the
  save-handler and (2) the suggest-date read/write logic now correctly
  branch on `item.clientField` (writing to the dedicated column via
  `patchClient()`) vs. the generic checklist JSON (`patchCL(clSec, key,
  value)`) — previously every suggest-field write went through the JSON
  path regardless of `clientField`, which silently no-opped for the new
  typed columns. Also fixed the suggest-button label to read
  `item.suggestFromLabel` instead of a hardcoded "denial date" string.
- `src/features/pipeline/components/KanbanCard.jsx` /
  `src/features/pipeline/PipelinePage.jsx` — BCBA "+ Assign" row now only
  renders once `STAGES.indexOf(client.stage) >= STAGES.indexOf('auth_assessment')`;
  `handleAssignBCBA` in `PipelinePage.jsx` rejects the assignment with a
  notification (`"BCBA can't be assigned until {name} reaches
  Auth/Assessment."`) if called against an earlier-stage client as a
  backstop to the hidden button. RBT assignment visibility (Staffing/
  Services only) was untouched.
- **Also bundled this session**: backfilled 4 local migration files for
  **ACD-68** and **ACD-78** — those tickets' DB changes were applied
  directly to the remote Supabase project via MCP in prior sessions but no
  local migration file was ever committed, so git history didn't match
  what's actually live. Reconstructed from the live schema
  (`information_schema.columns`/`pg_constraint`/`pg_policy`), documentation
  only, nothing re-run against the DB. Kept as a separate commit from the
  ACD-79 feature work. Noted on both the PR and the Jira ticket.
- **Manual QA completed** against the live-code-feel E2E mock mode
  (`VITE_E2E=1 VITE_DEMO_MODE=true`), with `FLAGS.PIPELINE` temporarily
  flipped to `true` **locally only**, reverted before commit (confirmed via
  `git diff` showing zero changes to `featureFlags.js`):
  - The `auth_submitted`/`cpt_97151_received` AND-gate logic was verified
    via a standalone Node script importing `itemComplete()` directly (8
    assertions — true/false/partial/whitespace-only edge cases, all pass)
    rather than through file-upload UI clicks, because this sandboxed
    browser's `file_upload` tool rejects local filesystem paths. The
    document-upload modal itself was confirmed to open correctly.
  - BCBA assign row confirmed hidden on Intake-stage cards and visible from
    Auth/Assessment onward, checked across the full Kanban board. RBT
    assignment visibility confirmed unaffected.
  - Both the pre-existing (`appeal_deadline`, checklist-JSON-based) and new
    (`cpt97151_expected_response_date`, `clientField`-based) suggest-date
    paths verified live with real data entry and saves on two different
    clients.
- `npx vite build` — clean, no new errors or warnings introduced.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both
`dev` and `main`, which are in sync. Working tree is clean. Next session
starts from a clean slate.

## 4. Everything tried that failed / walked back

- Nothing on the code itself was walked back — both fixes (AND-gate
  tightening, BCBA stage guard) and the `clientField` branching fix were
  shipped as drafted once QA passed.
- `mcp__Claude_in_Chrome__file_upload` rejected a local path
  (`/tmp/test-roi.pdf`) with "no longer accepts host filesystem paths" —
  confirmed via ToolSearch this is an environment-level restriction, not
  something fixable via a different tool-call shape. Pivoted to a
  standalone Node script testing `itemComplete()` directly instead of
  UI-clicking the upload — this actually exercised more edge cases
  (whitespace-only reference numbers, checkbox-true-but-dependency-false,
  etc.) than a manual upload click would have.
- An apparent blank/white screenshot early in QA turned out to be a
  screenshot-timing artifact, not a real bug — `get_page_text` on the same
  page showed the login screen had rendered correctly; a follow-up
  screenshot confirmed it. No code or environment fix was needed.
- Initially undercounted the backfilled migration files as "three" when
  describing them to the user (there are four — three from ACD-68, one from
  ACD-78); corrected before committing so all four landed in the same
  commit together.

## 5. Next steps

1. **[ACD-111](https://awcbehavioralhealth.atlassian.net/browse/ACD-111)** —
   real end-to-end test of the ACD-77 emailed-indicator feature (actual
   delivered email reaching `status = 'sent'` through the real send path).
   Blocked by ACD-101. Not started.
2. **[ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)**
   (Resend domain verification) — still blocked on DNS access to a real
   domain; pending leadership's help to unblock. Carried forward.
3. **[ACD-109](https://awcbehavioralhealth.atlassian.net/browse/ACD-109)** —
   Supabase Auth's default email rate limit blocks real invite/bulk-import
   use. Needs a transactional email provider; explicitly deferred pending
   leadership confirmation before committing to a vendor. Not started.
4. **[ACD-110](https://awcbehavioralhealth.atlassian.net/browse/ACD-110)** —
   rewrite the Playwright "Staff Page" suite for the real-backend flow.
   **Do not build until `FLAGS.STAFF` is actually flipped** — tracked as
   part of ACD-99. Not started.
5. **[ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100)**
   ("Wire client documents to real Supabase storage + table") — appears
   substantially or fully covered by prior ACD-108 work, modulo a
   column-naming mismatch (`doc_type`/`field_label` vs. the ticket's literal
   ask for `document_type`). Still awaiting the user's answer on whether to
   close it or leave it open pending that naming check — carried forward
   again, do not close unilaterally.
6. **Manual QA for ACD-73** — confirm no Session Log/Reassessment tabs
   appear anywhere in the Services stage, no console errors, other
   Services-stage functionality still works. **Wait until the
   `FLAGS.PIPELINE` flip.** Carried forward.
7. **[ACD-105](https://awcbehavioralhealth.atlassian.net/browse/ACD-105)** —
   wire ACD-69's denial-tracking and staff-contact columns (backend already
   Done) into the actual frontend UI. Not started.
8. **[ACD-90](https://awcbehavioralhealth.atlassian.net/browse/ACD-90)**
   ("E1: Add automated tests proving staff can only see their own data") —
   still unblocked-but-pending. **Wait until the `FLAGS.PIPELINE` flip.**
9. **[ACD-106](https://awcbehavioralhealth.atlassian.net/browse/ACD-106)** —
   CLAUDE.md's "What This Repo Is NOT" section is stale on the
   Pipeline/Trench-5 exclusion. Not started.
10. **Manual QA against the ACD-67 acceptance criteria** — still outstanding
    even though the Jira ticket itself shows "Done." **Wait until the
    `FLAGS.PIPELINE` flip.**
11. **[ACD-107](https://awcbehavioralhealth.atlassian.net/browse/ACD-107)** —
    `.github/workflows/e2e.yml` has no cache for the Playwright browser
    binary. Not started.
12. **[ACD-99](https://awcbehavioralhealth.atlassian.net/browse/ACD-99)** —
    "C1: Flip the feature flags to launch the pipeline and staff management
    for real" (`FLAGS.PIPELINE` and `FLAGS.STAFF`). Not flipped for real —
    still gated behind an explicit future ask per CLAUDE.md rule 4. Items 6,
    8, and 10 above are explicitly waiting on this flip to be actionable,
    and ACD-110 should be done as part of this effort.
13. Local branch cleanup still pending from prior sessions (stale local
    feature branches never explicitly confirmed for deletion) — low
    priority, worth a `git branch -d` pass whenever the user wants a tidy
    local branch list. `ACD-78-diagnosis-pending-insurance-status` and
    `ACD-79-authorization-proof-fields` can both be added to that cleanup
    now, since their PRs into `main` are merged.
14. The suggest-date label fix (`suggestFromLabel`) only covers the two
    items that currently use `suggestFromField` (`appeal_deadline`,
    `cpt97151_expected_response_date`). If a future stage adds another
    `suggestFromField` item, remember to set `suggestFromLabel` on it too —
    there's no fallback/default text if it's omitted (renders as
    `undefined`).
