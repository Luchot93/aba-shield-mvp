-- ACD-XX: Same root bug as 20261014120000_fix_client_assignment_rls_staff_id.sql,
-- found immediately after applying that fix to the RLS dev project --
-- re-running `npm run test:rls` surfaced failures in tests/rls/child-tables.test.js
-- for the same reason: public.can_access_client() (added in
-- 20260928130000_client_checklist_documents_activity.sql), which gates
-- checklist_items/documents/activity_log and the client-documents storage
-- bucket, has the identical wrong-id-space comparison baked in --
-- `c.bcba_id = auth.uid() or c.rbt_id = auth.uid()` -- for the same reason
-- as the clients policies: bcba_id/rbt_id store staff.id, not auth.uid().
--
-- Checked for other instances of this pattern before writing this migration:
-- assessment_sessions.bcba_id and service_session_logs.bcba_id also compare
-- directly to auth.uid() (20260721163319_explicit_with_check.sql), but those
-- are a genuinely different, correctly-designed column -- FK'd straight to
-- auth.users(id) (see 20260720120000_baseline_remote_schema.sql), an
-- ownership model ("the session/log this BCBA personally created"), not an
-- assignment model. Left unchanged; not the same bug.
--
-- Fix: reuse is_assigned_staff() (added in the prior migration) instead of
-- comparing bcba_id/rbt_id to auth.uid() directly. No policy needs to be
-- touched -- every policy on checklist_items/documents/activity_log/storage
-- already calls can_access_client(), so redefining the function alone fixes
-- all of them.
create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client_id
      and (
        public.is_admin()
        or public.is_assigned_staff(c.bcba_id)
        or public.is_assigned_staff(c.rbt_id)
      )
  );
$$;
