-- Backfilled local copy of a migration applied directly to the remote project
-- via the Supabase MCP during ACD-68 work, without a local file being written
-- at the time. Reconstructed from the live schema on 2026-10-01 to close the
-- gap between local migration history and what's actually applied -- not
-- being re-run, only recorded. Verified against information_schema.columns,
-- pg_constraint, and pg_policy on the live `case_notes` table.
--
-- Free-form case notes per client, timestamped and attributed to the staff
-- member who wrote them. Reuses the existing can_access_client(client_id)
-- helper (already defined for other client-scoped tables -- see
-- 20260928120000_client_staff_assignment_rls.sql) so access follows the same
-- admin-or-assigned rule as the rest of the pipeline.

create table public.case_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  author_id  uuid references auth.users(id),
  stage      text,
  text       text not null,
  created_at timestamptz not null default now()
);

alter table public.case_notes enable row level security;

create policy "case_notes select admin or assigned"
  on public.case_notes for select
  using (can_access_client(client_id));

create policy "case_notes insert admin or assigned"
  on public.case_notes for insert
  with check (can_access_client(client_id));
