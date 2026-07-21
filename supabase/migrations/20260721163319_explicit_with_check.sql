-- ACD-52: Make RLS ownership policies explicit with WITH CHECK.
-- The 4 ALL-command ownership policies had only a USING clause (filters
-- readable/affected rows) and no WITH CHECK (validates INSERT/UPDATE row values).
-- Ownership was enforced but not auditable. Recreate each with both clauses,
-- WITH CHECK mirroring USING, preserving the exact ownership expressions.

-- clients (user_id)
drop policy "own clients" on public.clients;
create policy "own clients" on public.clients
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- staff (user_id)
drop policy "own staff" on public.staff;
create policy "own staff" on public.staff
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- assessment_sessions (bcba_id)
drop policy "own sessions" on public.assessment_sessions;
create policy "own sessions" on public.assessment_sessions
  for all
  using (bcba_id = auth.uid())
  with check (bcba_id = auth.uid());

-- service_session_logs (bcba_id)
drop policy "own logs" on public.service_session_logs;
create policy "own logs" on public.service_session_logs
  for all
  using (bcba_id = auth.uid())
  with check (bcba_id = auth.uid());
