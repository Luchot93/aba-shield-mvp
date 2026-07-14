#!/usr/bin/env bash
#
# Weekly logical backup of the ABA Vault production database (Supabase / Postgres 17).
#
# Dumps the public/auth/storage schemas, gzips the result into the private
# aba-vault-backups repo, commits + pushes it, and prunes to the most recent
# 12 weekly snapshots.
#
# Prerequisites (all manual, see scripts/restore-test.md and the ACD-37 ticket):
#   - pg_dump major version 17 installed (must match the Supabase Postgres major version)
#   - the private aba-vault-backups repo cloned next to this app repo
#   - SUPABASE_DB_URL exported in the environment (never hardcoded)
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://...'   # from Supabase > Settings > Database
#   ./scripts/backup.sh

set -euo pipefail

# --- Configuration -----------------------------------------------------------

# Path to the private backups repo. Defaults to a sibling of the app repo, but
# can be overridden via BACKUPS_REPO_DIR for non-standard layouts.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUPS_REPO_DIR="${BACKUPS_REPO_DIR:-${APP_REPO_DIR}/../aba-vault-backups}"

RETENTION_WEEKS=12

# --- Preflight checks --------------------------------------------------------

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is not set. Export it before running:" >&2
  echo "  export SUPABASE_DB_URL='postgresql://...'" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install PostgreSQL 17 client tools." >&2
  exit 1
fi

# pg_dump major version must match the server (Postgres 17). A mismatch can
# silently produce a dump that will not restore cleanly.
PG_DUMP_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -n1)"
if [[ "${PG_DUMP_MAJOR}" != "17" ]]; then
  echo "ERROR: pg_dump major version is ${PG_DUMP_MAJOR}, expected 17 (to match the Supabase Postgres server)." >&2
  echo "       Install PostgreSQL 17 client tools and ensure that pg_dump is on PATH." >&2
  exit 1
fi

if [[ ! -d "${BACKUPS_REPO_DIR}/.git" ]]; then
  echo "ERROR: backups repo not found at: ${BACKUPS_REPO_DIR}" >&2
  echo "       Clone the private aba-vault-backups repo next to this app repo first." >&2
  exit 1
fi

# --- Backup ------------------------------------------------------------------

DATE="$(date +%F)"                        # YYYY-MM-DD
OUTFILE="${BACKUPS_REPO_DIR}/${DATE}_aba_vault.sql.gz"

echo "Dumping public/auth/storage schemas to ${OUTFILE} ..."

# --no-owner / --no-privileges keep the dump portable to a scratch restore DB.
# Pipe straight into gzip so the plaintext dump never touches disk.
pg_dump \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --no-owner \
  --no-privileges \
  "${SUPABASE_DB_URL}" \
  | gzip -9 > "${OUTFILE}"

echo "Wrote $(du -h "${OUTFILE}" | cut -f1) backup."

# --- Prune to the most recent RETENTION_WEEKS snapshots ----------------------

echo "Pruning to the most recent ${RETENTION_WEEKS} weekly snapshots ..."
# Newest first; delete everything past the retention window. Read line-by-line
# (no mapfile) so this works on the bash 3.2 that ships with macOS.
ls -1t "${BACKUPS_REPO_DIR}"/*_aba_vault.sql.gz 2>/dev/null \
  | tail -n +$((RETENTION_WEEKS + 1)) \
  | while IFS= read -r old; do
      [[ -n "${old}" ]] || continue
      echo "  removing $(basename "${old}")"
      git -C "${BACKUPS_REPO_DIR}" rm --quiet --ignore-unmatch "${old}" || rm -f "${old}"
    done

# --- Commit + push -----------------------------------------------------------

echo "Committing and pushing to the backups repo ..."
git -C "${BACKUPS_REPO_DIR}" add -A
if git -C "${BACKUPS_REPO_DIR}" diff --cached --quiet; then
  echo "No changes to commit."
else
  git -C "${BACKUPS_REPO_DIR}" commit -m "backup: ${DATE} aba_vault (public/auth/storage)"
  git -C "${BACKUPS_REPO_DIR}" push
fi

echo "Done. Backup ${DATE} complete."
