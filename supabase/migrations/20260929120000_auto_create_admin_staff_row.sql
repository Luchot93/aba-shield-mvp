-- ACD-71 (A5): Auto-create a `staff` row whenever a profile becomes admin,
-- so admins created outside the Invite Staff flow (direct SQL/dashboard role
-- change, or the original backfill pattern in profiles_table.sql) still show
-- up correctly instead of requiring manual seeding. This was a real gap
-- found while building this ticket: all 5 real accounts (1 admin, 4 BCBAs)
-- had zero matching staff rows until one was seeded by hand for testing.
--
-- Scope: admin only, mirroring the question raised in the ACD-71 ticket
-- comment. The 4 orphaned BCBA profiles found during investigation are
-- pre-existing accounts outside this flow and are intentionally left alone
-- here -- not this ticket's scope to backfill them.
--
-- Unique constraint on staff.user_id is required for ON CONFLICT DO NOTHING
-- below, and also closes a real race with supabase/functions/manage-staff's
-- invite flow: without it, an admin invited through the UI could end up
-- with two staff rows (one bare-bones from this trigger, one fully detailed
-- from the invite payload). NULLs stay unrestricted, so legacy/local mock
-- staff rows with no user_id are unaffected.

alter table public.staff
  add constraint staff_user_id_unique unique (user_id);

create or replace function public.handle_admin_promoted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.staff (user_id, name, role, status)
  values (
    new.id,
    coalesce(new.full_name, (select email from auth.users where id = new.id), 'Admin'),
    'admin',
    'active'
  )
  on conflict (user_id) do nothing;
  return new;
end; $$;

-- Split into two triggers (rather than one combined INSERT OR UPDATE
-- trigger) because a WHEN clause can't reference OLD for an INSERT event --
-- OLD isn't defined yet at insert time.
drop trigger if exists on_profile_admin_promoted_insert on public.profiles;
create trigger on_profile_admin_promoted_insert
  after insert on public.profiles
  for each row
  when (new.role = 'admin')
  execute function public.handle_admin_promoted();

drop trigger if exists on_profile_admin_promoted_update on public.profiles;
create trigger on_profile_admin_promoted_update
  after update of role on public.profiles
  for each row
  when (new.role = 'admin' and old.role is distinct from 'admin')
  execute function public.handle_admin_promoted();
