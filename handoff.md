# Session Handoff

_Last updated: 2026-09-28_

## 1. Goal we are moving towards

[ACD-68](https://awcbehavioralhealth.atlassian.net/browse/ACD-68) ("A2: Save
checklist ticks, uploaded documents, and activity history for real"), part of
Epic [ACD-6](https://awcbehavioralhealth.atlassian.net/browse/ACD-6) "CRM /
Client Pipeline — Field-Level PRD Rollout." **Pipeline (Trench 5) reactivation
is now confirmed underway** — this supersedes CLAUDE.md's original "What This
Repo Is NOT" framing for Pipeline, which was written for the Alpha-only scope.
The user is doing this ticket-by-ticket, backend-first, before flipping
`FLAGS.PIPELINE`: ACD-67 (client/staff RLS, done prior session) → **ACD-68
(this session)** → ACD-69 (A3: missing DB fields, next) → ACD-90 (E1:
automated RLS tests, next).

Problem ACD-68 solves: per-client checklist state, uploaded documents, and the
activity/audit log were never persisted in Postgres — `PHASE2_DEFAULTS` /
`enrichClient()` in `src/lib/db.js` injected empty `documents: []`,
`activity_log: []`, `reassessment_sessions: []`,
`caregiver_training_session_logs: []` onto every client purely client-side, so
any tick/upload/log entry vanished on refresh. This matches the backend
architecture direction already on record (dedicated tables + per-row RLS
instead of JSON blobs on `clients`, one trench at a time).

**Status: schema-only work shipped.** Tables + RLS + storage bucket are live.
Frontend wiring (checklist/document/activity-log UI actually calling these
tables) is explicitly NOT part of this ticket and has not been started.

## 2. Current state of the code

**Live in production** on Supabase project `ABA_VAULT_MVP`
(`qravuejkiluimaihhbrf`) — applied via `apply_migration` before committing, so
the repo matches what's live.

- Migration file:
  `supabase/migrations/20260928130000_client_checklist_documents_activity.sql`
- `public.can_access_client(target_client_id uuid)` — new `security definer`
  helper, wraps the existing `is_admin()` plus `bcba_id = auth.uid() or
  rbt_id = auth.uid()`. Reused by all three tables' policies and the storage
  policies, instead of inlining the same `exists(...)` check nine times.
- `checklist_items` (id, client_id fk→clients cascade, stage, item_key, label,
  is_complete, completed_by fk→auth.users, completed_at, created_at, unique
  on (client_id, stage, item_key)) — SELECT/INSERT/UPDATE policies, no
  DELETE. Toggleable (tick/un-tick is an UPDATE on the unique-keyed row).
- `documents` (id, client_id fk cascade, stage, storage_path, file_name,
  mime_type, uploaded_by fk→auth.users, uploaded_at) — SELECT/INSERT only.
  **No UPDATE policy** — permanent once created, by design (see §4).
- `activity_log` (id, client_id fk cascade, actor_id fk→auth.users, action,
  detail jsonb, created_at) — SELECT/INSERT only, same permanent-record
  reasoning as `documents`.
- All three scoped via `can_access_client()`: admin sees/writes everything;
  BCBA/BCaBA/RBT only for a client they're actually assigned to
  (`bcba_id`/`rbt_id`) — narrower than the directory-wide `staff`/`profiles`
  read policies from the prior ACD-67 migration.
- New private Storage bucket `client-documents` (separate from
  `assessment-documents`): 25MB limit, `application/pdf`,
  `.docx`, `image/png`, `image/jpeg`. Objects keyed by
  `{client_id}/{filename}` (not `{uid}/...` like `assessment-documents`,
  because access here is shared across whichever staff are assigned to that
  client). SELECT + INSERT policies on `storage.objects` cast
  `(storage.foldername(name))[1]` to uuid and run it through
  `can_access_client()`.
- Verified via `list_tables` (`rls_enabled: true` on all three) and
  `get_advisors` (security) — no new findings beyond the same accepted
  `is_admin()`-pattern warning, now also covering `can_access_client()` (anon
  always gets `false`; not a real vulnerability, same reasoning as last
  session).

**Git/PR trail:**
- PR [#69](https://github.com/Luchot93/aba-shield-mvp/pull/69)
  `ACD-68-client-checklist-documents-activity` → `dev` — merged by me (user
  approved via chat). CI (build + Playwright) + Vercel preview all passed.
- PR [#70](https://github.com/Luchot93/aba-shield-mvp/pull/70) `dev` → `main`
  — merged by the user directly on GitHub.
- **Incident, recovered:** merging PR #70 on GitHub also deleted the `dev`
  branch on origin (user clicked the post-merge "Delete branch" button,
  not realizing `dev` is the persistent integration branch, not a feature
  branch — repo-level `delete_branch_on_merge` is `false`, so this was a
  one-off manual click, not a standing setting). Recreated `origin/dev`
  immediately from local at the exact same commit (`6e637ff`) — zero data
  loss, confirmed via `git ls-remote`.
- **Unrelated finding, also resolved:** `main` had a commit (`6ac8818`,
  "chore: install impeccable design-review skill", predates this session)
  that was committed straight to `main` and never reached `dev`. Cherry-picked
  it onto `dev` (new commit `a19d6c6`, pushed directly — purely additive
  `.agents/skills/impeccable/` files, no conflicts). Confirmed via
  `git diff origin/main..origin/dev` (two-dot, full content comparison) that
  `main` and `dev` are now byte-identical — no further PR needed for this.

**No frontend code was touched this session** — purely Supabase schema/RLS +
process docs.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync. Working tree is clean. Next session starts
from a clean slate.

## 4. Everything tried that failed / walked back

- Ticket spec initially wrote the RLS check as an inline `exists(select 1
  from clients c where c.id = <table>.client_id and (c.bcba_id = auth.uid()
  or c.rbt_id = auth.uid() or (select role from profiles where id =
  auth.uid()) = 'admin'))`, repeated per policy. Replaced with the
  `can_access_client()` helper (reusing the existing `is_admin()`) instead —
  same logic, defined once, and it's what makes the storage policy possible
  at all (no `client_id` column on `storage.objects`; the path has to be
  parsed and checked the same way). **User confirmed this deviation was
  fine** before I applied the migration.
- Initial migration draft gave `documents` and `activity_log` the same
  SELECT/INSERT/UPDATE symmetry as `checklist_items`. Walked back after
  asking the user directly: only `checklist_items` needs to be toggled after
  creation (a checkbox flips back and forth); an uploaded document or a
  logged action should be a **permanent record** — no UPDATE policy on
  either table. **Landed on**: `checklist_items` gets UPDATE,
  `documents`/`activity_log` do not.
- Accidentally deleted `origin/dev` when merging PR #70 (see §2). Not a
  code/design failure, but worth remembering: **don't click "Delete branch"
  after merging a PR whose head is `dev`** (or `main`) — that button is safe
  for feature branches, not for persistent branches. Recovered with a plain
  `git push origin dev` from local.
- Confirmed (again, as in the ACD-67 session) that DB changes take effect the
  moment they're applied via the Supabase MCP, not when the PR merges — the
  PR trail is bookkeeping for the migration-history paper trail, not the
  activation event.

## 5. Next steps

1. **ACD-69** ("A3: Add missing database fields the app already expects —
   denial info, staff contact details") is next in the ACD-6 sequence, and
   was blocked by ACD-68 — now unblocked.
2. **ACD-90** ("E1: Add automated tests proving staff can only see their own
   data") was also blocked by ACD-68 — now unblocked. Also matches the
   long-deferred "Story E1" automated RLS coverage noted after the ACD-67
   session.
3. **Frontend wiring is still entirely unstarted**: no `db.js` functions for
   checklist_items/documents/activity_log, nothing in `ClientDetailPage.jsx`
   or elsewhere calls these new tables yet. `FLAGS.PIPELINE` stays `false`
   until this exists and the user explicitly says to flip it.
4. **CLAUDE.md is now stale** on the Pipeline/Trench-5 exclusion — it still
   says "do not add, reference, or assume [Pipeline] exists in this repo."
   Worth revisiting/updating CLAUDE.md itself to reflect that Pipeline
   reactivation is confirmed underway, so a future session (or a different
   agent reading CLAUDE.md cold) doesn't re-litigate the same scope question
   this session opened with. Not done yet — flagged, not actioned, pending
   the user's call.
5. Manual QA against the ACD-67 acceptance criteria (admin sees all clients,
   BCBA/RBT see only assigned, non-admin reassignment rejected, Staff
   Directory loads) is still outstanding from the prior session — carried
   forward, still not done.
6. Optional, explicitly declined last session: revoke `anon` execute on
   `public.is_admin()` to silence the advisor warning. Same applies to the
   new `can_access_client()` now. Not necessary, trivial if ever wanted.
