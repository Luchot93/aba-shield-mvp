# Session Handoff

_Last updated: 2026-09-28_

## 1. Goal we are moving towards

[ACD-69](https://awcbehavioralhealth.atlassian.net/browse/ACD-69) ("A3: Add
missing database fields the app already expects — denial info, staff contact
details"), part of Epic [ACD-6](https://awcbehavioralhealth.atlassian.net/browse/ACD-6)
"CRM / Client Pipeline — Field-Level PRD Rollout." Same ticket-by-ticket,
backend-first sequence as the last two sessions, ahead of flipping
`FLAGS.PIPELINE`: ACD-67 (client/staff RLS) → ACD-68 (checklist/documents/
activity persistence) → **ACD-69 (this session)** → next up: ACD-90 (E1:
automated RLS tests, still unblocked from before) and the frontend-wiring
follow-up this session intentionally deferred (see §5).

Problem ACD-69 solves: the Pipeline/Kanban UI (`KanbanCard.jsx`,
`ClientDetailPage.jsx`) already reads/writes `denial_reason`, `denial_count`,
`denial_from_stage` on clients, and the Invite Staff form (`InvitePanel.jsx`)
already collects `email`, `phone`, `cert_number`, `npi`, `hire_date` for
staff — but none of these existed as columns, so the values were silently
undefined. This session added the columns only.

**Status: schema-only work shipped**, same shape as ACD-68. The columns
exist and are ready, but nothing calls them yet — denial info and staff
invites still won't survive a page refresh until the frontend wiring
follow-up lands (explicitly scoped out this session, see §5).

## 2. Current state of the code

**Live in production** on Supabase project `ABA_VAULT_MVP`
(`qravuejkiluimaihhbrf`) — applied via `apply_migration` before committing,
so the repo matches what's live.

- Migration file:
  `supabase/migrations/20260928140000_client_denial_staff_contact_fields.sql`
- `clients` gets 3 new columns: `denial_reason` (text, nullable),
  `denial_count` (integer, `not null default 0`), `denial_from_stage` (text,
  nullable).
- `staff` gets 6 new columns: `email`, `phone`, `cert_number`, `npi`,
  `hire_date` (date), `availability` (text) — all nullable. `staff` already
  had `cert_expiry`; `cert_number` is new and distinct from it.
- Purely additive — no existing column touched, no RLS policy changes
  needed (existing admin-or-assigned policies on both tables already cover
  whatever columns the rows have).
- Verified via `information_schema.columns` query (all 9 columns present
  with correct types/nullability) and `get_advisors` (security) — no new
  findings; only the same pre-existing, already-reviewed warnings
  (`is_admin`/`can_access_client`/`handle_new_user` anon-executable RPCs,
  `rate_limits` RLS-no-policy, leaked-password-protection).

**Git/PR trail:**
- PR [#71](https://github.com/Luchot93/aba-shield-mvp/pull/71)
  `ACD-69-denial-staff-contact-fields` → `dev` — merged by the user on
  GitHub. Branch auto-deleted cleanly on merge (feature branch, not
  persistent — no repeat of the ACD-68-session `dev`-deletion incident).
- PR [#72](https://github.com/Luchot93/aba-shield-mvp/pull/72) `dev` → `main`
  — merged by the user on GitHub. Confirmed `main`/`dev` byte-identical via
  `git diff origin/main..origin/dev` (empty) after merge.
- Also carried the uncommitted `handoff.md` rewrite that had been sitting in
  the working tree since the ACD-68 session (never committed then) — caught
  at the start of this session, committed directly to `dev` first
  (`6e3d5d3`, per the user's explicit approval) before the ACD-69 branch was
  created, then rebased ACD-69 onto it.

**No frontend code was touched this session** — purely a Supabase migration
+ process docs. Grepped for client-side fakes of these fields per the user's
request; see §4 for what was found (nothing to remove).

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync (local branches fast-forwarded to origin).
Working tree is clean. Next session starts from a clean slate.

## 4. Everything tried that failed / walked back

- User asked to grep the frontend for places that "fake or default these
  fields client-side (e.g. in db.js's `enrichClient`/`PHASE2_DEFAULTS`)" and
  remove the fakes so real DB values flow through. **Investigated, found
  nothing to remove**: `PHASE2_DEFAULTS` never included any of these 9
  fields in the first place, so there was no fake there to begin with —
  `getClients()` already does `select('*')`, so the new columns flow through
  for free once something writes to them.
- Bigger discovery from that grep: `db.js` has **no `updateClient` function
  at all**, and **no staff functions whatsoever** (no `getStaff`/
  `createStaff`). The places that set these fields today —
  `ClientDetailPage.jsx`'s `patchClient` (denial fields) and
  `StaffPage.jsx`'s `handleInvite` — only call `setClients`/`setStaff`
  (in-memory React state), never Supabase. This is gated Pipeline/Staff code
  (`FLAGS.PIPELINE`/`FLAGS.STAFF`), so nothing here was overriding real DB
  values (there's no real-value flow yet to override). **Decision: left
  this code alone** — removing the local defaults would have broken the
  gated UI with no replacement.
- Because of that, ACD-69's literal acceptance criteria ("denial reason/
  count/stage visible after a refresh"; "staff invite fields saved") is
  **not actually met yet** — the columns exist but nothing persists to them.
  Flagged this explicitly to the user rather than silently scope-creeping
  into building `updateClient`/staff persistence mid-session. **User's
  call: hold it for a dedicated follow-up when frontend wiring work
  starts** — not done this session, not a small addition.
- Established a new standing process rule mid-session (see project memory
  `feedback_handoff_preview_before_commit`): always show the full
  `handoff.md` content and get explicit approval before committing it at
  session close, rather than committing automatically. This file follows
  that rule.

## 5. Next steps

1. **Frontend wiring for ACD-69** (no ticket number yet, unstarted): add
   `updateClient()` to `db.js` (doesn't exist today) and wire
   `ClientDetailPage.jsx`'s `patchClient` deny-flow through it; add
   `getStaff()`/`createStaff()` (also don't exist) and wire
   `StaffPage.jsx`'s `handleInvite` through them. Only then does ACD-69's
   actual acceptance criteria (survives refresh) get met. Confirm with the
   user whether this becomes its own Jira ticket before starting.
2. **ACD-90** ("E1: Add automated tests proving staff can only see their own
   data") — still unblocked and pending, carried forward from the last two
   sessions.
3. **CLAUDE.md is still stale** on the Pipeline/Trench-5 exclusion — still
   flagged, not actioned, pending the user's call (carried forward
   unchanged from the last session).
4. **Manual QA against the ACD-67 acceptance criteria** (admin sees all
   clients, BCBA/RBT see only assigned, non-admin reassignment rejected,
   Staff Directory loads) — still outstanding, carried forward again.
5. Optional, still declined: revoke `anon` execute on `public.is_admin()`
   and `public.can_access_client()` to silence the advisor warnings. Not
   necessary, trivial if ever wanted.
