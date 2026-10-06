-- ACD-83: Denied stage real columns — denial date/code, appeal deadline/outcome,
-- and a flag for an appeal upheld after being sent back from Auth/Assessment.
-- Does not touch the existing denial_reason / denial_count / denial_from_stage columns.

alter table clients
  add column denial_date date,
  add column denial_code text,
  add column appeal_deadline date,
  add column appeal_outcome text,
  add column stage2_appeal_upheld boolean not null default false;

alter table clients
  add constraint clients_appeal_outcome_check
  check (appeal_outcome is null or appeal_outcome in ('Approved', 'Upheld', 'Pending'));
