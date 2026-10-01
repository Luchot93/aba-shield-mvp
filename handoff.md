# Session Handoff

_Last updated: 2026-10-01_

## 1. Goal we are moving towards

[ACD-76](https://awcbehavioralhealth.atlassian.net/browse/ACD-76) ("B5") —
make Invite, Edit, Revoke, and Bulk Import on the Staff page actually work
against real accounts, instead of the local-state-only mock left over from
earlier trenches. This is gated Phase-2 code behind `FLAGS.STAFF` (still
`false` in production) — the goal was to make the Staff write-path correct
and Supabase-backed (real `auth.users` accounts via a `manage-staff` edge
function) so it's ready whenever that flag is flipped for real, not to ship
it live this session.

**Status: shipped, merged to `dev`. PR into `main` about to be opened.**

## 2. Current state of the code

**Merged to `dev` (PR [#89](https://github.com/Luchot93/aba-shield-mvp/pull/89),
commit `f647b40`). Not yet in `main`.** Inert in production either way
because `FLAGS.STAFF` stays `false`.

- `supabase/functions/manage-staff/index.ts` — `handleInvite` creates a real
  `auth.users` account (`inviteUserByEmail`) and a matching `staff` row
  before promoting `profiles.role`, ordered specifically so a promotion to
  `admin` can't race the `handle_admin_promoted()` trigger into creating a
  duplicate bare-bones `staff` row. `handleRevoke` fully deletes the account
  (staff row first, then `auth.users`, since `staff.user_id` is `ON DELETE
  NO ACTION`) rather than deactivating it, since revoke is only reachable
  for invites that haven't been accepted yet.
- Fixed a real bug in both the invite and edit paths: the invite/edit forms
  send `''` (not `undefined`) for blank `date`-typed columns
  (`cert_expiry`, `hire_date`, `cert_effective_date`), which Postgres
  rejects as `invalid input syntax for type date: ""`. `?? null` doesn't
  catch empty string; switched to `|| null` in `manage-staff/index.ts` and
  `src/features/staff/components/StaffCard.jsx`.
- New `src/features/staff/functionError.js` — `extractFunctionError()` works
  around `supabase.functions.invoke()` throwing before the response body is
  parsed (the real `{ error: '...' }` message lives in `error.context`, a
  `Response`, and must be `.json()`'d). `friendlyInviteError()` and the new
  `friendlyRevokeError()` translate raw backend/Postgres/Auth error text
  into clinic-admin-readable copy (e.g. "rate limit" → "Email rate limit
  reached — try again later"); both share a `rateLimitMessage()` helper.
- `src/features/staff/StaffPage.jsx` — pending invites now derive from the
  persisted `staff` list (`status === 'pending'`) instead of separate local
  state, so they survive a page reload. `handleRevoke` now runs its raw
  error through `friendlyRevokeError()` instead of showing raw backend text.
- `src/features/staff/components/BulkInvitePanel.jsx` — makes real per-row
  `manage-staff` invite calls instead of fabricating local rows; tracks
  succeeded/failed per row and renders a results summary; stays open until
  the user dismisses it instead of auto-closing.
- **Live QA completed**, all against real Supabase Auth using alias
  variants of the admin's own email (`luis.teranarguello+staffqaN@gmail.com`):
  invite → pending persists across reload; edit-save with blank dates → no
  Postgres error; revoke through the real UI → both the `staff` row and the
  `auth.users` account confirmed deleted; a separately-created orphaned test
  account was deleted directly and the `profiles` row cascade-deleted
  automatically (FK is `ON DELETE CASCADE`), confirming no manual profile
  cleanup is needed on revoke.
- Bulk Import was tested twice with real CSV batches and hit Supabase
  Auth's default email rate limit both times — this is the real, now-
  confirmed blocker, not a code bug. Filed
  [ACD-109](https://awcbehavioralhealth.atlassian.net/browse/ACD-109)
  ("Staff invites fail with Supabase Auth email rate limit — needs
  transactional email provider"), linked to ACD-76 via "Relates".
- `npx vite build` — clean, no new errors or warnings introduced.

## 3. Files actively being edited

None in flight — everything is committed and merged into `dev`. Working
tree is clean. Next session (or the rest of this one) starts from opening
the `dev` → `main` PR.

## 4. Everything tried that failed / walked back

- Chrome MCP's `file_upload` tool stopped accepting host filesystem paths
  mid-session (a change in the tool's behavior, not a bug in this repo) —
  worked around by using `javascript_tool` to construct a `File`/
  `DataTransfer` object in-page and dispatch a `change` event directly,
  rather than giving up on live bulk-import QA.
- Nothing on the code itself was walked back — the invite/edit/revoke/bulk
  fixes were all shipped as drafted once QA passed.
- Considered rewriting the stale Playwright "Staff Page" suite in
  `tests/pipeline.spec.js` as part of this session, since its tests
  (hardcoded seed counts/IDs, synchronous-after-submit invite assertions)
  are now incompatible with the real-backend flow shipped here. Decided
  **not** to build that now, since `FLAGS.STAFF` is off and the suite is
  currently skipped in CI (`gated(FLAGS.STAFF)` → `test.describe.skip`) —
  instead filed [ACD-110](https://awcbehavioralhealth.atlassian.net/browse/ACD-110)
  and linked it to [ACD-99](https://awcbehavioralhealth.atlassian.net/browse/ACD-99)
  ("flip FLAGS.PIPELINE/FLAGS.STAFF for real"), so the rewrite happens
  alongside that flip rather than being speculatively built now.

## 5. Next steps

1. **Open the `dev` → `main` PR for this session's ACD-76 work** — in
   progress right now as this handoff is being written.
2. **[ACD-109](https://awcbehavioralhealth.atlassian.net/browse/ACD-109)** —
   Supabase Auth's default email rate limit blocks real invite/bulk-import
   use. Needs a transactional email provider (Mailchimp or similar is the
   current guess); explicitly deferred pending leadership confirmation
   before committing to a vendor. Not started.
3. **[ACD-110](https://awcbehavioralhealth.atlassian.net/browse/ACD-110)** —
   rewrite the Playwright "Staff Page" suite for the real-backend flow
   (mock `manage-staff` at the test-seam level instead of hitting real
   Supabase Auth; rebuild fixtures instead of the old hardcoded 12-person
   seed; add coverage for friendly error translation, bulk-import results
   UI, and empty-date-as-null handling). **Do not build until `FLAGS.STAFF`
   is actually flipped** — tracked as part of ACD-99. Not started.
4. **[ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100)**
   ("Wire client documents to real Supabase storage + table") — appears
   substantially or fully covered by the prior session's ACD-108 work,
   modulo a column-naming mismatch (`doc_type`/`field_label` vs. the
   ticket's literal ask for `document_type`). Still awaiting the user's
   answer on whether to close it or leave it open pending that naming
   check — carried forward again, do not close unilaterally.
5. **Manual QA for ACD-73** — confirm no Session Log/Reassessment tabs
   appear anywhere in the Services stage, no console errors, other
   Services-stage functionality still works. **Wait until the
   `FLAGS.PIPELINE` flip.** Carried forward.
6. **[ACD-105](https://awcbehavioralhealth.atlassian.net/browse/ACD-105)** —
   wire ACD-69's denial-tracking and staff-contact columns (backend already
   Done) into the actual frontend UI. Not started.
7. **[ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)**
   (Resend domain verification) — still blocked on DNS access to a real
   domain; pending leadership's help to unblock. Carried forward.
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
    for real" (`FLAGS.PIPELINE` and `FLAGS.STAFF`). Staff's write-side
    (invite/edit/revoke/bulk import, this session) and read-side (prior
    session) are both validated; Pipeline's persistence layer (checklist,
    documents, case notes, pipeline-stage actions, client creation) is also
    validated from the prior session. Not flipped for real — still gated
    behind an explicit future ask per CLAUDE.md rule 4. Items 5, 8, and 10
    above are explicitly waiting on this flip to be actionable, and ACD-110
    should be done as part of this effort.
13. Local branch cleanup still pending from two sessions ago (stale
    `ACD-108-...` and older local feature branches, never explicitly
    confirmed for deletion) — low priority, worth a `git branch -d` pass
    whenever the user wants a tidy local branch list. The new
    `ACD-76-invite-edit-revoke-bulk-import` branch will need the same
    treatment once its PR into `main` is merged.
