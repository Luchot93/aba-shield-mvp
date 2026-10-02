# Session Handoff

_Last updated: 2026-10-02_

## 1. Goal we are moving towards

[ACD-80](https://awcbehavioralhealth.atlassian.net/browse/ACD-80) ("D3") —
clean up the Assessment stage checklist: remove a redundant item (`bcba_confirmed`,
which never measured anything since BCBA assignment is already a hard blocker
earlier in the pipeline), fix a mislabeled item (`direct_observation` →
`maladaptive_behaviors_section`), fix stale-test detection so Vineland-3/BASC-3
items only count complete when the paired date is within the last 12 months,
add "Not Applicable" skip options for `additional_assessments` and
`prior_assessments`, and gate a new `diagnosis_confirmed` item on
`diagnosis_pending` so it only appears for clients whose diagnosis wasn't
confirmed at Intake. The `smart_assessment_submitted` bridge/export signal was
investigated and found to already match intent — left as-is per explicit user
decision.

**Status: shipped, merged to both `dev` and `main`. Ticket moved to Done.
Session closed.**

## 2. Current state of the code

**Merged to `dev`
([PR #97](https://github.com/Luchot93/aba-shield-mvp/pull/97)) and promoted to
`main` ([PR #98](https://github.com/Luchot93/aba-shield-mvp/pull/98)).** Local
`main` and `dev` fast-forwarded to match origin at session close; both
branches are in sync.

- `src/constants/checklist.js` — `mkChecklist()`'s `assessment` section:
  removed `bcba_confirmed`, renamed `direct_observation` →
  `maladaptive_behaviors_section` (same `sessionKey`), added
  `additional_assessments_na`. `auth_assessment` section: added
  `prior_assessments_na`. `getStageItems` signature changed to
  `(stage, client)` so the `assessment` case can conditionally splice in a
  `diagnosis_confirmed` item (`type: 'auto', diagnosisGate: true`) when
  `client?.diagnosis_pending === true`. `additional_assessments` and
  `prior_assessments` items both gained `naSkippable: true`.
  `final_assessment_report` gained a sublabel noting the Vineland-3/BASC-3
  graphs must be added manually (the Smart Assessment export can't contain
  them).
- `src/utils/checklist.js` — new shared helper `getRecentDateStatus(dateStr)`
  returning `'empty' | 'future' | 'stale' | 'current'` (stale = >12 months
  past), used by both completion logic and the UI. `itemComplete()`: the
  `'dated'` case now requires the checkbox AND a date that resolves to
  `'current'` (previously any date satisfied it). Added a generic
  `naSkippable` branch — if `client.checklist[clSec][`${key}_na`] === true`,
  the item is treated as complete regardless of type. The `'auto'` case
  gained a `diagnosisGate` branch: complete unless `diagnosis_pending` is
  true and `diagnosis`/`icd10` are still blank.
- `src/features/detail/ClientDetailPage.jsx` — `getStageItems(stageToShow,
  client)` now passes `client` through. `CheckRow` gained a reusable `NAToggle`
  element (checkbox + "N/A — not used for this case" label, click-guarded so
  it doesn't trigger the parent card's toggle) rendered for both
  `naSkippable` checkbox- and file_upload-type items. The `'dated'` branch
  now derives `dateStatus` from `getRecentDateStatus()` and shows a red
  border + inline warning text ("Administered more than 12 months ago — a
  new administration is required." / "Date can't be in the future.")
  instead of the old one-sided "isOld" check. **Also fixed a bug found during
  QA**: the `file_upload` item type never rendered `item.sublabel` — added
  it, since without the fix the new `final_assessment_report` sublabel
  (Vineland-3/BASC-3 graphs note) was set in data but invisible in the UI.
- `src/constants/seedData.js` — updated 7 seeded clients: removed
  `bcba_confirmed:true`, renamed `direct_observation:true` →
  `maladaptive_behaviors_section:true`.
- **Manual QA completed** against the live-code-feel E2E mock mode
  (`VITE_E2E=1 VITE_DEMO_MODE=true`), with `FLAGS.PIPELINE` temporarily
  flipped to `true` **locally only**, reverted before commit (confirmed via
  `git diff` showing zero changes to `featureFlags.js`):
  - A standalone 14-assertion Node script importing `itemComplete()` and
    `getStageItems()` directly confirmed `diagnosisGate`, `naSkippable`
    (both items), the `'dated'` stale/future/current logic, and the
    `bcba_confirmed`/`direct_observation` changes — all pass.
  - Live-clicked through Emma Thompson (Assessment stage): confirmed the
    renamed "Maladaptive behaviors section captured" label, the Vineland-3
    stale-date warning (red border + message, counts incomplete) and its
    clearing on a recent date (counts complete), the `additional_assessments`
    N/A toggle (counts complete, badge flips to "N/A"), and the now-visible
    `final_assessment_report` sublabel.
  - Live-clicked through Amelia Wilson (Auth Assessment stage): confirmed the
    `prior_assessments` N/A toggle works the same way.
- `npx vite build` — clean, no new errors or warnings introduced.
- Jira ticket ACD-80 transitioned to **Done**.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both
`dev` and `main`, which are in sync. Working tree is clean. Next session
starts from a clean slate.

## 4. Everything tried that failed / walked back

- Nothing on the code itself was walked back — all changes were shipped as
  drafted once QA passed.
- The `file_upload` sublabel bug (see section 2) was not part of the original
  plan — it was discovered only through live browser QA after the rest of
  the diff had already been reviewed, and was fixed within the same session/
  commit rather than filed separately, since it was directly blocking
  visibility of a requirement (the Vineland-3/BASC-3 graphs note) that was
  already in scope.
- Chrome MCP session logged out mid-QA after a hard page reload; re-login via
  `form_input` + a ref-based button click initially appeared not to register
  (page still showed the sign-in form on the next check), but turned out to
  just be the same screenshot/render-timing artifact noted in the ACD-79
  handoff — a follow-up screenshot confirmed the login had actually
  succeeded. No code or environment fix was needed.

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
    local branch list. `ACD-78-diagnosis-pending-insurance-status`,
    `ACD-79-authorization-proof-fields`, and
    `ACD-80-assessment-checklist-cleanup` can all be added to that cleanup
    now, since their PRs into `main` are merged.
14. The suggest-date label fix (`suggestFromLabel`, from ACD-79) only covers
    the two items that currently use `suggestFromField` (`appeal_deadline`,
    `cpt97151_expected_response_date`). If a future stage adds another
    `suggestFromField` item, remember to set `suggestFromLabel` on it too —
    there's no fallback/default text if it's omitted (renders as
    `undefined`).
