-- ACD-92 (E3): Audit log for admin actions on staff (invite/revoke), written
-- by the manage-staff edge function. Deliberately a separate table from
-- public.activity_log (ACD-68/A2) rather than reusing it: that table's
-- client_id is NOT NULL with an FK to clients, and both its RLS policies
-- gate entirely on can_access_client(client_id) -- staff invite/revoke has
-- no client to attach to, and bending that table's client-only assumption
-- risked confusing every other reader of it (e.g. ClientDetailPage's
-- Activity tab). This table mirrors its shape (actor_id, action, detail
-- jsonb, created_at) without the client coupling.
--
-- manage-staff writes with the service role key, which bypasses RLS --
-- the policies below exist so these rows are still protected if anything
-- ever reads/writes them with a user's own session instead.

create table public.staff_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.staff_activity_log enable row level security;

create policy "staff_activity_log select admin only" on public.staff_activity_log
  for select
  using (public.is_admin());

create policy "staff_activity_log insert admin only" on public.staff_activity_log
  for insert
  with check (public.is_admin());
