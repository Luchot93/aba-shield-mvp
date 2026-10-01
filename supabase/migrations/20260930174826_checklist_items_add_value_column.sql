-- Backfilled local copy of a migration applied directly to the remote project
-- via the Supabase MCP during ACD-68 work, without a local file being written
-- at the time. Reconstructed from the live schema on 2026-10-01 to close the
-- gap between local migration history and what's actually applied -- not
-- being re-run, only recorded. Verified against information_schema.columns:
-- `value` exists on `checklist_items` as nullable text, no default.
--
-- Adds a free-form value column so checklist_items can store non-boolean
-- answers (dates, numbers, select choices, free text) alongside the existing
-- is_complete boolean, instead of only supporting plain ticks.

alter table public.checklist_items
  add column value text;
