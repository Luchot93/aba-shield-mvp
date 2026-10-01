# Session Handoff

_Last updated: 2026-10-01_

## 1. Goal we are moving towards

[ACD-77](https://awcbehavioralhealth.atlassian.net/browse/ACD-77) ("B6") —
add a small "emailed" indicator to the in-app notification list so clinicians
can see which stage-change alerts also triggered a real email, using the
`email_notifications` table (added in a prior trench alongside the
`send-notification-email` edge function) as the source of truth. This is a
minor UI addition on top of the existing in-app notification list, not a
redesign — and the badge only reflects a **confirmed** `status = 'sent'` row
(not a mere send attempt), per explicit product decision.

**Status: shipped, merged to both `dev` and `main`. Session closed.**

## 2. Current state of the code

**Merged to `dev` (PR [#91](https://github.com/Luchot93/aba-shield-mvp/pull/91),
commit `63220f8`) and promoted to `main` (PR
[#92](https://github.com/Luchot93/aba-shield-mvp/pull/92)).** Local `main`
and `dev` fast-forwarded to match origin at session close; both branches are
in sync.

- `src/utils/notifications.js` — `mkNotif()` now accepts an optional 4th
  `clientId` param (only passed by call sites paired with a real
  `sendStageChangeEmail()` call). New `getEmailedKeys(clientIds)` returns a
  `Set` of `"clientId::subject"` keys for every email confirmed `sent`, used
  to correlate a local in-app notification with its `email_notifications`
  row — there's no shared ID between the two, so the same `subject` string
  passed to both `mkNotif()` and `sendStageChangeEmail()` at each call site
  is the correlation key.
- `src/lib/db.js` — new `getSentEmailNotifications(clientIds)` query
  (`email_notifications` filtered to `status = 'sent'`), following the file's
  existing pattern (plain async query fn, no business logic).
- `src/components/icons.jsx` — new `Mail` icon.
- `src/components/NavBar.jsx` — notification panel now fetches
  `getEmailedKeys()` when it opens and renders a small teal mail-icon badge
  next to any notification whose `clientId::subject` key is in that set.
- `src/features/detail/ClientDetailPage.jsx` — the 3 stage-change call sites
  (`doAdvance`, `doDeny`, `doReturnFromDenied`) now pass `client.id` as the
  4th `mkNotif()` arg, so **every** stage transition on the client card
  (not just specific ones) is covered. The separate "parent email simulation"
  notification (no real paired email) and `api/check-auth-expiry.js`'s cron
  notifications (no paired local `mkNotif()` at all) were deliberately left
  untagged — out of scope for this minor UI addition.
- **Manual QA completed** (see QA comment on ACD-77): temporarily set
  `FLAGS.PIPELINE = true` **locally only** to reach the gated notification
  panel, triggered a real stage change (Submitted → Denied) on the test
  fixture "RLS Test Client ACD-52," confirmed a real `email_notifications`
  row was created (`status = 'failed'`, as expected — see blocker below),
  manually flipped that row's status to `'sent'` via Supabase MCP, confirmed
  the badge rendered next to the correct notification only (verified via
  DOM `data-testid`, not just visually), then reverted the row to `'failed'`
  and the client's `stage`/`pipeline_entry`/`denial_from_stage` back to their
  original `null`/`false` values. `FLAGS.PIPELINE` was reverted to `false`
  before commit — confirmed via `git diff` showing zero changes to
  `featureFlags.js`.
- `npx vite build` — clean, no new errors or warnings introduced.
- Confirmed `tests/pipeline.spec.js`'s "Notifications" describe block stays
  statically skipped (`gated(FLAGS.PIPELINE)` → `test.describe.skip`), so the
  NavBar structural changes carry no CI risk.

**Blocker (not fixed this session, by design):** real email delivery is
still blocked by Resend sending-domain/DNS verification
([ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)) — in
production today every send lands as `status = 'failed'`, so the badge is
logically correct but won't visibly appear for real users until that's
resolved. Filed
[ACD-111](https://awcbehavioralhealth.atlassian.net/browse/ACD-111) ("E2E
verify 'emailed' notification indicator once Resend domain is live"),
linked "Relates to" ACD-77 and "is blocked by" ACD-101, with cross-reference
comments left on all three tickets — same pattern as how ACD-70 was closed
previously with delivery confirmation deferred.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync. Working tree is clean. Next session starts
from a clean slate.

## 4. Everything tried that failed / walked back

- Nothing on the code itself was walked back — the indicator logic, the
  `clientId` correlation approach, and the 3 tagged call sites were all
  shipped as drafted once QA passed.
- Considered wiring `api/check-auth-expiry.js`'s auth-expiry cron emails
  into the same badge, but that cron has no corresponding local in-app
  `mkNotif()` entry at all (it's a separate server-side-only flow) — decided
  that's a different, larger scope than "a minor UI addition" and left it
  alone rather than expanding this ticket.
- Flipping `FLAGS.PIPELINE` for QA required an explicit mid-session ask and
  sign-off (per CLAUDE.md rule 4 — never flip a flag without being asked),
  even though general "go ahead and test" permission had already been given;
  paused specifically to confirm that covered a flag flip before proceeding.

## 5. Next steps

1. **[ACD-111](https://awcbehavioralhealth.atlassian.net/browse/ACD-111)** —
   real end-to-end test of the emailed-indicator feature (actual delivered
   email reaching `status = 'sent'` through the real send path, not a
   manually-edited test row). Blocked by ACD-101. Not started.
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
    `ACD-77-emailed-notification-indicator` branch can now be added to that
    cleanup too, since its PR into `main` is merged.
