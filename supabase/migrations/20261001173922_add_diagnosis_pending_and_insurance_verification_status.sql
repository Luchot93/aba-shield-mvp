-- Backfilled local copy of a migration applied directly to the remote project
-- via the Supabase MCP during ACD-78 (D1) work, without a local file being
-- written at the time. Reconstructed from the live schema on 2026-10-01 to
-- close the gap between local migration history and what's actually applied
-- -- not being re-run, only recorded. Verified against
-- information_schema.columns and pg_constraint on the live `clients` table.
--
-- diagnosis_pending: lets Intake proceed without the CDE on file when a
-- diagnosis isn't ready yet (see checklist.js's `cde` item orClientField).
-- insurance_verification_status: replaces the old single insurance_verified
-- boolean with a 3-way status; only 'verified' satisfies the Intake gate.

alter table public.clients
  add column diagnosis_pending boolean not null default false,
  add column insurance_verification_status text not null default 'not_verified'
    constraint clients_insurance_verification_status_check
    check (insurance_verification_status in ('not_verified', 'requested', 'verified'));
