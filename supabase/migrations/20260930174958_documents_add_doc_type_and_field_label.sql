-- Backfilled local copy of a migration applied directly to the remote project
-- via the Supabase MCP during ACD-68 work, without a local file being written
-- at the time. Reconstructed from the live schema on 2026-10-01 to close the
-- gap between local migration history and what's actually applied -- not
-- being re-run, only recorded. Verified against information_schema.columns:
-- both columns exist on `documents` as nullable text, no default, no check
-- constraint restricting values.
--
-- doc_type classifies an uploaded document against the checklist item that
-- produced it (e.g. 'cde', 'consent', 'prior_assessments') so uploads can be
-- matched back to their originating checklist row. field_label stores the
-- human-readable label shown in the UI at upload time, for display without
-- re-deriving it from the (possibly since-renamed) checklist item definition.

alter table public.documents
  add column doc_type text,
  add column field_label text;
