-- ACD-112: assessment_sessions was the one client-scoped table still using the
-- old "own sessions" ownership policy (bcba_id = auth.uid(), FOR ALL, no admin
-- bypass) instead of the shared can_access_client(client_id) pattern every
-- other client-scoped table uses (checklist_items, documents, activity_log,
-- behavior_session_logs, skill_session_logs, caregiver_training_session_logs
-- -- see 20260928130000_client_checklist_documents_activity.sql and
-- 20261006170000_acd86_service_sessions_schema.sql). Admins querying another
-- BCBA's assessment sessions got zero rows regardless of the application-level
-- query, because RLS filtered them out underneath.
--
-- Fix: drop the single FOR ALL ownership policy, replace with the house
-- select/insert/update split using can_access_client(client_id) -- the table
-- already has a client_id FK. No delete policy existed in practice (no
-- deleteAssessmentSession call site in src/lib/db.js), so none is added here,
-- matching checklist_items' select/insert/update-only shape.
--
-- Known, accepted tradeoff (confirmed with product owner): this also grants
-- an assigned RBT read/write access to a client's assessment session, where
-- previously only the creating BCBA could see it. If leadership wants RBTs
-- excluded from assessment data specifically, that needs a narrower follow-up
-- (e.g. a can_access_client variant that excludes RBT), not reverting this.
drop policy "own sessions" on public.assessment_sessions;

create policy "assessment_sessions select admin or assigned" on public.assessment_sessions
  for select
  using (public.can_access_client(client_id));

create policy "assessment_sessions insert admin or assigned" on public.assessment_sessions
  for insert
  with check (public.can_access_client(client_id));

create policy "assessment_sessions update admin or assigned" on public.assessment_sessions
  for update
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));
