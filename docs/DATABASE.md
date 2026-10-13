# Database & Migrations

How schema changes happen in `aba-shield-mvp`. Read this before touching the database.

## The rule

**Every schema change goes through a migration file.** Never run DDL (CREATE / ALTER /
DROP / policy / bucket changes) in the Supabase dashboard SQL editor. Dashboard DDL is
invisible to git, so the next person's local schema drifts from production and nobody can
tell what changed or why. A migration file is the single source of truth and the audit trail.

Data fixes (one-off `UPDATE`/`INSERT` to rows) are fine ad hoc. Structure is not.

## The workflow

One-time setup: the CLI must be linked to the project (`supabase link --project-ref <ref>`)
before `db push` / `migration list` will talk to the right database.

```bash
supabase migration new descriptive_name   # 1. scaffold a timestamped .sql file
                                           # 2. write your SQL in the generated file
                                           #    (review it — this is the permanent record)
supabase db push                           # 3. apply pending migrations to the linked DB
supabase migration list                    # 4. verify: local and remote columns match
git add supabase/migrations/<file>.sql     # 5. commit the migration file — MANUALLY
```

Commits are always manual in this repo (see `docs/GIT_WORKFLOW.md`). Never auto-commit a
migration. One migration = one focused change with a descriptive name.

## Current schema (`public`)

Eight tables. Seven are used in Alpha; one ships dormant for Phase 2 (gated by `FLAGS.*`).

| Table                  | Purpose                                                        | Phase |
|------------------------|----------------------------------------------------------------|-------|
| `clients`              | Client/patient demographics + intake. Phase-2 pipeline columns present but null in Alpha. | Alpha |
| `assessment_sessions`  | Initial-assessment interview state, AI draft content, approvals, exported docs. | Alpha |
| `profiles`             | One row per auth user; `role` (admin/bcba/bcaba/rbt), auto-created on signup. Drives permissions. | Alpha |
| `rate_limits`          | Per-user/endpoint/hour counter guarding `/api/generate`, `/api/generate-definition`, and the `manage-staff`/`send-notification-email` Edge Functions. No client access; touched only by the `check_rate_limit` definer function. | Alpha |
| `behavior_session_logs` | Behavior-target session logging (Service Sessions page). | Alpha |
| `skill_session_logs`   | Skill-goal session logging (Service Sessions page).            | Alpha |
| `caregiver_training_session_logs` | Caregiver-training session logging (Service Sessions page). | Alpha |
| `staff`                | Staff directory.                                               | Phase 2 (`FLAGS.STAFF`) |

All eight have RLS enabled. Access is scoped to the owning user (`auth.uid()`).

> RLS is automatic. An event trigger (`rls_auto_enable`) turns on row-level security the
> moment any new `public` table is created — so a fresh table denies **all** access until
> you also add a policy in the same migration. Empty results on a new table usually means
> "no policy yet," not "no data."

> Note: the ACD-48 baseline dump (`..._baseline_remote_schema.sql`) emits `CREATE TABLE`
> for only the four core app tables; `profiles` and `rate_limits` are created by their own
> earlier migrations. All six exist in the live database.

### Rate limiting — `check_rate_limit` (ACD-35, extended in ACD-95)

One Postgres function (`public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer)`,
`SECURITY DEFINER`, defined in `supabase/migrations/20260713201033_rate_limits.sql`) backs every
rate limit in the app. It atomically increments the caller's current-hour window in `rate_limits`
and returns `true`/`false` for under/over the cap; callers are fail-open (an RPC error is logged
and treated as allowed — a limiter outage must never block clinical work).

| Caller | Runtime | Helper | Endpoint key | Limit/hour |
|--------|---------|--------|--------------|------------|
| `api/generate.js` | Vercel (Node) | `api/_lib/rateLimit.js` | `generate` | 30 |
| `api/generate-definition.js` | Vercel (Node) | `api/_lib/rateLimit.js` | `generate-definition` | 60 |
| `supabase/functions/manage-staff` | Supabase Edge Function (Deno) | `supabase/functions/_shared/rateLimit.ts` | `manage-staff` | 20 |
| `supabase/functions/send-notification-email` | Supabase Edge Function (Deno) | `supabase/functions/_shared/rateLimit.ts` | `send-notification-email` | 200 |

There are two helpers with the identical RPC-call pattern, not one shared file, because Vercel's
`api/` functions run on Node and Supabase Edge Functions run on Deno — `api/_lib/rateLimit.js`
can't be imported from `supabase/functions/`. `manage-staff`'s 20/hour reflects that invite/revoke
are rare, deliberate admin actions; `send-notification-email`'s 200/hour is set much higher because
it fires on every stage change and checklist completion across all staff, so normal volume is
already higher than `manage-staff`'s.

**Grants**: the migration runs `revoke execute ... from anon, public` and `grant execute ... to
authenticated`, but never mentions `service_role` — both Edge Functions call the RPC through their
existing `service_role`-keyed admin client, not a user-context client. This works because
`service_role` already carries `EXECUTE` on every `public` function via Supabase's default
privilege grants, which were never revoked here. Verified directly against the production project
(`qravuejkiluimaihhbrf`) via `information_schema.routine_privileges`:

```
grantee        | privilege_type
---------------+---------------
postgres       | EXECUTE
authenticated  | EXECUTE
service_role   | EXECUTE
```

So no grant changes or auth-context rework were needed to extend rate limiting to the Edge
Functions — confirm this still holds (`select grantee, privilege_type from
information_schema.routine_privileges where routine_name = 'check_rate_limit';`) if a future
migration ever touches these grants.

### JSONB design note — `assessment_sessions.sections`

The entire 12-section interview lives in one `jsonb` column (`sections`), not in normalized
child tables. Each key holds that section's notes, structured data (STO / behavior / skill
goals), `draftContent`, `approvalState`, and `generatedPromptHash`. Rationale: sections
change shape constantly during Alpha, so a schema-free blob means fast iteration with no
migration per field, and one atomic save via `updateAssessmentSession`. Trade-off: no
per-section SQL querying or constraints — that's acceptable while the app owns all reads.
`client_profile`, `documents`, and `result` on the same table are JSONB for the same reason.

## Storage buckets

| Bucket                  | Visibility | Size limit | Allowed types |
|-------------------------|------------|------------|---------------|
| `assessment-documents`  | Private    | 25 MB      | `.docx`, `.pdf` only |

Private = no public URLs. RLS on `storage.objects` restricts each user to their own
`{uid}/` folder prefix for read and upload. Constraints set in
`..._bucket_constraints.sql`: `file_size_limit = 26214400`, `allowed_mime_types` =
Word docx + PDF (the only two document types the app produces).

## Checking for drift

```bash
supabase db diff        # shows any difference between the linked DB and local migrations
```

Empty output = no drift; local migrations fully describe production. Any output means
something was changed outside a migration — capture it in a new migration file, then
re-run until the diff is clean.

> Caveat: `db diff` spins up a local shadow database via Docker. If Docker isn't running,
> use `supabase db diff --linked` to diff against the remote directly.
