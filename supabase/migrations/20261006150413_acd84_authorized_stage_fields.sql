-- ACD-84: Authorized stage (Stage 7) real columns — weekly session schedule,
-- per-CPT scheduled hours/week, and session location. All become required
-- at this stage per the PRD ("No optional fields on this stage").
-- staff.cert_number (Prompt A3) already exists live — not touched here.

alter table clients
  add column schedule_template text,
  add column scheduled_hours_week integer,
  add column scheduled_97155_week integer,
  add column scheduled_97156_week integer,
  add column session_location text;
