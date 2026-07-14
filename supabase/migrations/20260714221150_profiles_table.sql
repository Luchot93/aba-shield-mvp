create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'bcba'
    check (role in ('admin','bcba','bcaba','rbt')),
  full_name text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
-- users can read their own profile
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
-- nobody can insert/update/delete via the API (service role only);
-- role changes happen via dashboard or future admin function
-- (no insert/update/delete policies = denied by default)

-- auto-create a profile on signup (default role bcba, NOT admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill the existing user as admin
insert into public.profiles (id, role)
select id, 'admin' from auth.users
on conflict (id) do update set role = 'admin';
