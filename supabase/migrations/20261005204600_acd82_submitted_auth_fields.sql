alter table clients
  add column if not exists plan_submission_date date,
  add column if not exists auth_reference_number text,
  add column if not exists authorized_97153 integer,
  add column if not exists authorized_97155 integer,
  add column if not exists authorized_97156 integer,
  add column if not exists auth_start_date date,
  add column if not exists auth_end_date date;

alter table clients
  add constraint auth_end_after_start
  check (auth_end_date is null or auth_start_date is null or auth_end_date > auth_start_date);
