-- ACD-102: Add missing database fields the staff-card edit form already reads/writes
-- but were never added to the schema -- same gap pattern as the ACD-69 denial/staff-
-- contact-fields migration. StaffCard.jsx's edit form (getInitialEditForm, handleEditSave)
-- collects title, supervisor, cert_effective_date, and caqh_id and passes them to
-- onEdit(id, editForm) -- but until this migration, saving that edit only updated local
-- React state, since these columns didn't exist to persist it to.
--
-- Purely additive, all nullable. No existing column touched, no RLS policy changes
-- needed -- the existing "staff insert/update/delete admin only" policy (see
-- supabase/migrations/20260928120000_client_staff_assignment_rls.sql) already covers
-- whatever columns the staff row has.

alter table public.staff
  add column title text,
  add column supervisor text,
  add column cert_effective_date date,
  add column caqh_id text;
