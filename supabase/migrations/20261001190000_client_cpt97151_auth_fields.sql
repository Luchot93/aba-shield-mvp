-- ACD-79 (D2): Authorization-proof fields for the CPT 97151 submission, so the
-- Auth/Assessment stage tracks the actual insurer interaction instead of a
-- single free-text "auth_portal" guess field. Previously these lived as
-- untyped strings inside the checklist_items JSON-equivalent rows
-- (submission_date, units_requested, expected_response_date, auth_portal,
-- reference_number) -- confirmed via query that no production rows exist yet
-- for those keys under stage='auth_assessment', so this is a safe move to
-- dedicated, typed columns rather than a destructive rename.
--
-- cpt97151_submission_method replaces the old free-text auth_portal with a
-- constrained dropdown (Availity / Fax / Phone / Other) in the UI.
-- cpt97151_units_approved is new -- recorded once the insurer responds.
--
-- Purely additive. All columns nullable (submission_date and
-- reference_number become required for `auth_submitted` to read as complete,
-- but that's enforced in application logic, not a NOT NULL constraint --
-- consistent with every other stage field in this table).

alter table public.clients
  add column cpt97151_submission_date date,
  add column cpt97151_reference_number text,
  add column cpt97151_submission_method text,
  add column cpt97151_units_requested integer,
  add column cpt97151_expected_response_date date,
  add column cpt97151_units_approved integer
    constraint cpt97151_units_approved_positive
    check (cpt97151_units_approved is null or cpt97151_units_approved > 0);
