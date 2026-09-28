-- ACD-69 (A3): Add missing database fields the frontend already reads/writes but
-- were never added to the schema, so they silently show undefined/blank:
--
-- `clients` -- KanbanCard.jsx and ClientDetailPage.jsx reference denial_count,
-- denial_from_stage, and denial_reason (set when a client is moved to the
-- `denied` stage -- see ClientDetailPage.jsx's stage-change handler at line
-- 356, which sets all three; line 1574 reads denial_from_stage to know which
-- stage to return the client to). None of these exist as columns today.
--
-- `staff` -- the Invite Staff form (InvitePanel.jsx) collects email, phone,
-- cert_number, npi, and hire_date; `availability` is added alongside for the
-- same staff-contact-detail scope even though no form currently collects it.
-- None of these exist as columns today -- `staff` currently only has
-- cert_expiry, not cert_number.
--
-- Purely additive. All new columns are nullable except denial_count, which
-- defaults to 0 (matching "no denials yet" and safe for any existing row).
-- No existing column touched, no RLS policy changes needed -- the existing
-- admin-or-assigned policies on `clients` and `staff` already cover whatever
-- columns those rows have.

alter table public.clients
  add column denial_reason text,
  add column denial_count integer not null default 0,
  add column denial_from_stage text;

alter table public.staff
  add column email text,
  add column phone text,
  add column cert_number text,
  add column npi text,
  add column hire_date date,
  add column availability text;
