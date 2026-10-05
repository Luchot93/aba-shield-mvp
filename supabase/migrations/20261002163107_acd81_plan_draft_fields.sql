alter table clients
  add column if not exists hours_97153 integer,
  add column if not exists hours_97155 integer,
  add column if not exists hours_97156 integer,
  add column if not exists data_methodology text,
  add column if not exists plan_start_date date,
  add column if not exists plan_end_date date,
  add column if not exists sessions_per_week integer,
  add column if not exists session_duration_min integer;

alter table clients
  add constraint plan_end_after_start
  check (plan_end_date is null or plan_start_date is null or plan_end_date > plan_start_date);
