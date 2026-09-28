-- ACD-XX: Client visibility + staff assignment RLS.
-- Replaces ownership-based access ("whoever created the row") on `clients` with
-- role/assignment-based access: admins can see and manage every client; a
-- BCBA/BCaBA/RBT can only see clients where they are the assigned bcba_id or
-- rbt_id. They CAN edit the normal working fields on their assigned clients
-- (stage, notes, session data, etc.) -- only reassigning WHO a client is
-- assigned to (bcba_id / rbt_id) is admin-only, enforced via trigger so a
-- blocked reassignment raises a clear error instead of a silent RLS no-op.
--
-- Also loosens staff/profiles read access so the Staff Directory and the
-- assignment dropdown work for every authenticated user, while keeping staff
-- writes admin-only. profiles keeps its existing stance of zero client-side
-- writes (service role / dashboard only, see profiles_table.sql) -- this
-- migration does not add any insert/update/delete policy to profiles.

-- ---------------------------------------------------------------------------
-- Helper: is_admin() -- shared role check used by the clients/staff policies
-- and the reassignment-guard trigger below. security definer + pinned
-- search_path so it isn't affected by whatever RLS currently governs
-- `profiles`, matching the house pattern used by handle_new_user() /
-- check_rate_limit() in earlier migrations.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- clients: replace ownership-based "own clients" with assignment-based access.
-- "own clients" was FOR ALL (covered select/insert/update/delete). Insert and
-- delete are out of scope for this change -- recreated below, unchanged, so
-- client creation/deletion doesn't silently break when the FOR ALL policy is
-- dropped.
-- ---------------------------------------------------------------------------
drop policy "own clients" on public.clients;

-- select: admin sees everything; bcba/bcaba/rbt see only their assigned clients
create policy "clients select admin or assigned" on public.clients
  for select
  using (
    public.is_admin()
    or bcba_id = auth.uid()
    or rbt_id = auth.uid()
  );

-- update: admin can update everything; bcba/bcaba/rbt can update their
-- assigned clients' working fields. Reassignment itself (bcba_id/rbt_id) is
-- blocked separately by the trigger below, regardless of this policy.
create policy "clients update admin or assigned" on public.clients
  for update
  using (
    public.is_admin()
    or bcba_id = auth.uid()
    or rbt_id = auth.uid()
  )
  with check (
    public.is_admin()
    or bcba_id = auth.uid()
    or rbt_id = auth.uid()
  );

-- insert/delete: unchanged from "own clients" -- recreated explicitly so
-- dropping the FOR ALL policy above doesn't leave these commands with no
-- policy at all (= denied by default).
create policy "clients insert own" on public.clients
  for insert
  with check (auth.uid() = user_id);

create policy "clients delete own" on public.clients
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- clients: reassignment guard. Only an admin may change bcba_id or rbt_id, no
-- matter what the UPDATE policy above allows for general fields. Enforced in
-- a trigger (not the RLS policy) specifically so a blocked reassignment
-- raises a clear, specific error instead of a generic RLS failure.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_client_assignment_admin_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.bcba_id is distinct from old.bcba_id
       or new.rbt_id is distinct from old.rbt_id then
      raise exception 'Only an admin can reassign a client''s BCBA or RBT.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_client_assignment_admin_only on public.clients;
create trigger trg_enforce_client_assignment_admin_only
  before update on public.clients
  for each row
  execute function public.enforce_client_assignment_admin_only();

-- ---------------------------------------------------------------------------
-- staff: "own staff" was FOR ALL (user_id = auth.uid()), covering
-- select/insert/update/delete. Spec: every authenticated user can read the
-- full staff directory (assignment dropdown + Staff Directory page); only
-- admins may add/edit/remove staff records.
-- ---------------------------------------------------------------------------
drop policy "own staff" on public.staff;

create policy "staff select all" on public.staff
  for select
  to authenticated
  using (true);

create policy "staff insert admin only" on public.staff
  for insert
  with check (public.is_admin());

create policy "staff update admin only" on public.staff
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "staff delete admin only" on public.staff
  for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles: "read own profile" only let a user see their own row, which
-- breaks the Staff Directory / assignment dropdown for everyone else. Widen
-- SELECT to every authenticated user. Per confirmed decision (Option A): no
-- new write capability is added here -- profiles keeps its existing stance
-- of zero insert/update/delete policies (service role / dashboard only, see
-- profiles_table.sql), unchanged by this migration.
-- ---------------------------------------------------------------------------
drop policy "read own profile" on public.profiles;

create policy "profiles select all" on public.profiles
  for select
  to authenticated
  using (true);
