# Session Handoff

_Last updated: 2026-10-01_

## 1. Goal we are moving towards

[ACD-78](https://awcbehavioralhealth.atlassian.net/browse/ACD-78) ("D1") —
at Intake, some clients don't have their diagnosis paperwork (CDE) ready
yet. Add a "Diagnosis Pending" checkbox so the case isn't stuck waiting on
that document, with a persistent reminder badge until a real diagnosis is
recorded (that happens later, at the Assessment stage). Also replace the
old single "insurance verified" checkbox with a more accurate 3-way status:
Not Verified / Requested / Verified — only "Verified" should unblock the
stage.

**Status: shipped, merged to both `dev` and `main`. Session closed.**

## 2. Current state of the code

**Merged to `dev` (PR [#93](https://github.com/Luchot93/aba-shield-mvp/pull/93))
and promoted to `main` (PR
[#94](https://github.com/Luchot93/aba-shield-mvp/pull/94), commit
`2a7c0be`).** Local `main` and `dev` fast-forwarded to match origin at
session close; both branches are in sync.

- `src/constants/checklist.js` — Intake stage items: the `cde` file_upload
  item gained `orClientField: 'diagnosis_pending'`; a new `diagnosis_pending`
  checkbox item (`optional: true`, `clientField: 'diagnosis_pending'`) sits
  directly below it. The old `insurance_verified` checkbox item was replaced
  with a `select` item `insurance_verification_status`
  (`clientField: 'insurance_verification_status'`, `completeValue: 'verified'`,
  options `not_verified` / `requested` / `verified`).
- `src/utils/checklist.js` — `itemComplete()`: added a `clientField` read
  path (falls back to the old nested `checklist[clSec][key]` lookup when
  absent) so items can read/write top-level `client` fields instead of the
  checklist JSON blob. `checkbox` items with `optional: true` now always
  count as complete (used by `diagnosis_pending`, which is a flag, not a
  requirement). `file_upload` now checks `orClientField` as an alternate
  satisfy-path before falling back to "missing." Added a `select` case
  (`val === item.completeValue`).
- `src/features/detail/ClientDetailPage.jsx` — renders the new checkbox and
  3-button select control (Not Verified / Requested / Verified, each with
  its own active-state color: slate / amber / emerald) in the Intake
  checklist; added the "⏳ Diagnosis Pending" badge to the client header,
  shown whenever `client.diagnosis_pending === true` and `client.diagnosis`
  is not set.
- `src/features/pipeline/components/KanbanCard.jsx` — same "⏳ Diagnosis
  Pending" badge condition added to the card, so the reminder is visible on
  every pipeline stage, not just the detail page.
- **Manual QA completed**, run against the Pipeline UI with
  `FLAGS.PIPELINE` temporarily flipped to `true` **locally only**, using the
  project's backend-free E2E mock mode (`VITE_E2E=1 VITE_DEMO_MODE=true` —
  the same mode Playwright's `webServer` uses), so no writes touched the
  real Supabase database:
  - Checked `diagnosis_pending` on a client with no `diagnosis` → CDE item
    renders "Not needed" and is counted complete via `orClientField`; "X of
    Y complete" counter incremented accordingly.
  - Confirmed the badge rendered on both `ClientDetailPage`'s header and the
    matching `KanbanCard`.
  - Confirmed the badge stayed hidden for a client that already had a
    `diagnosis` set.
  - Cycled the insurance select through all three states: "Requested" shows
    amber active styling and does **not** satisfy the gate (count
    unchanged); "Verified" shows emerald active styling and **does** satisfy
    it (count increments); "Not Verified" is the slate/inactive default.
  - `FLAGS.PIPELINE` reverted to `false` before commit — confirmed via
    `git diff` showing zero changes to `featureFlags.js`.
- `npx vite build` — clean, no new errors or warnings introduced.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both
`dev` and `main`, which are in sync. Working tree is clean. Next session
starts from a clean slate.

## 4. Everything tried that failed / walked back

- Nothing on the code itself was walked back — the OR-gate approach for
  `diagnosis_pending` and the 3-state select for insurance verification
  were both shipped as drafted once QA passed.
- The `computer` screenshot tool returned blank/white images throughout
  this session's QA (on both port 5176 and 5177) despite the DOM being
  populated — worked around entirely via `read_page` (accessibility tree)
  and direct DOM/`innerText` inspection instead of visual screenshots; no
  functional impact on the QA itself.
- First attempt at creating a QA test client failed silently (modal stayed
  open) because DOB / Insurer Name / Member ID are required but weren't
  filled in initially — not a bug, just an incomplete first attempt.
- After creating the QA test client with "Add to pipeline" checked, it
  landed in the Directory with a separate "+ Add to pipeline" button rather
  than going straight into the Intake stage — required an explicit second
  click. Also not a bug; just the existing two-step flow.

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
13. Local branch cleanup still pending from prior sessions (stale
    `ACD-108-...` and older local feature branches, never explicitly
    confirmed for deletion) — low priority, worth a `git branch -d` pass
    whenever the user wants a tidy local branch list. The
    `ACD-78-diagnosis-pending-insurance-status` branch can now be added to
    that cleanup too, since its PR into `main` is merged.
