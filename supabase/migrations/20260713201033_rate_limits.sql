create table public.rate_limits (
  user_id uuid not null,
  endpoint text not null,
  window_start timestamptz not null,
  call_count integer not null default 1,
  primary key (user_id, endpoint, window_start)
);
alter table public.rate_limits enable row level security;
-- no policies = no client access; only service role / definer
-- function touches this table

create or replace function public.check_rate_limit(
  p_user_id uuid, p_endpoint text, p_max_calls integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare current_window timestamptz := date_trunc('hour', now());
        current_count integer;
begin
  insert into rate_limits (user_id, endpoint, window_start)
  values (p_user_id, p_endpoint, current_window)
  on conflict (user_id, endpoint, window_start)
  do update set call_count = rate_limits.call_count + 1
  returning call_count into current_count;
  -- opportunistic cleanup of old windows
  delete from rate_limits where window_start < now() - interval '24 hours';
  return current_count <= p_max_calls;
end; $$;

-- lock it down: only intended callers
revoke execute on function public.check_rate_limit(uuid, text, integer)
  from anon, public;
grant execute on function public.check_rate_limit(uuid, text, integer)
  to authenticated;
