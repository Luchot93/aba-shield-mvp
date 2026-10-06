-- ACD-85: Staffing stage (Stage 8) real columns — first session date and
-- time. schedule_template and session_location already exist from ACD-84
-- (Prompt D7) and are repointed here, not re-added.

alter table clients
  add column first_session_date date,
  add column first_session_time text;
