-- ACD-XX: Fix clients RLS assignment comparison -- bug found during a full
-- production QA sweep (see docs/full-sweep-production-qa-report.md §3).
--
-- clients.bcba_id/rbt_id store staff.id (the staff table's own primary key)
-- -- that's what the real app writes whenever a BCBA/RBT is assigned (see
-- src/features/pipeline/PipelinePage.jsx's handleAssignBCBA/handleAssignRBT,
-- and every staff lookup in src/lib/db.js / checklist.js, all of which match
-- a staff row via `s.id === client.bcba_id` / `s.id === client.rbt_id`).
--
-- The policies added in 20260928120000_client_staff_assignment_rls.sql
-- compared bcba_id/rbt_id directly against auth.uid(), which returns
-- staff.user_id -- a different id space (staff.id != staff.user_id; no FK
-- even ties them together). Since staff.id never equals auth.uid(), a real
-- assigned BCBA/RBT could never match the `bcba_id = auth.uid()` /
-- `rbt_id = auth.uid()` clauses and saw zero of their own clients --
-- defeating the entire point of the assignment model. Confirmed live
-- against production with real staff/client rows.
--
-- The existing automated RLS suite (tests/rls/clients.test.js) didn't catch
-- this because its fixture seeding (tests/rls/setup.js) wrote the fixture
-- users' own auth ids directly into bcba_id/rbt_id instead of their
-- staff.id -- a test-fixture bug that doesn't mirror how the real app
-- writes these columns, fixed in the same commit as this migration.
--
-- Fix: is_assigned_staff() looks up the staff row BY ITS OWN id and compares
-- *that* row's user_id to auth.uid() -- the correct join -- in place of the
-- direct, wrong-id-space `bcba_id = auth.uid()` comparison. security
-- definer + pinned search_path, matching the house pattern used by
-- is_admin() above it.
-- ---------------------------------------------------------------------------
create or replace function public.is_assigned_staff(assigned_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where id = assigned_staff_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_assigned_staff(uuid) from public;
grant execute on function public.is_assigned_staff(uuid) to anon, authenticated;

drop policy "clients select admin or assigned" on public.clients;
create policy "clients select admin or assigned" on public.clients
  for select
  using (
    public.is_admin()
    or public.is_assigned_staff(bcba_id)
    or public.is_assigned_staff(rbt_id)
  );

drop policy "clients update admin or assigned" on public.clients;
create policy "clients update admin or assigned" on public.clients
  for update
  using (
    public.is_admin()
    or public.is_assigned_staff(bcba_id)
    or public.is_assigned_staff(rbt_id)
  )
  with check (
    public.is_admin()
    or public.is_assigned_staff(bcba_id)
    or public.is_assigned_staff(rbt_id)
  );
