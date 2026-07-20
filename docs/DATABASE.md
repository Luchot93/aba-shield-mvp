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

Six tables. Four are used in Alpha; two ship dormant for Phase 2 (gated by `FLAGS.*`).

| Table                  | Purpose                                                        | Phase |
|------------------------|----------------------------------------------------------------|-------|
| `clients`              | Client/patient demographics + intake. Phase-2 pipeline columns present but null in Alpha. | Alpha |
| `assessment_sessions`  | Initial-assessment interview state, AI draft content, approvals, exported docs. | Alpha |
| `profiles`             | One row per auth user; `role` (admin/bcba/bcaba/rbt), auto-created on signup. Drives permissions. | Alpha |
| `rate_limits`          | Per-user/endpoint/hour counter guarding `/api/generate`. No client access; touched only by the `check_rate_limit` definer function. | Alpha |
| `service_session_logs` | Session logging.                                               | Phase 2 (`FLAGS.SESSION_LOG`) |
| `staff`                | Staff directory.                                               | Phase 2 (`FLAGS.STAFF`) |

All six have RLS enabled. Access is scoped to the owning user (`auth.uid()`).

> RLS is automatic. An event trigger (`rls_auto_enable`) turns on row-level security the
> moment any new `public` table is created — so a fresh table denies **all** access until
> you also add a policy in the same migration. Empty results on a new table usually means
> "no policy yet," not "no data."

> Note: the ACD-48 baseline dump (`..._baseline_remote_schema.sql`) emits `CREATE TABLE`
> for only the four core app tables; `profiles` and `rate_limits` are created by their own
> earlier migrations. All six exist in the live database.

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
