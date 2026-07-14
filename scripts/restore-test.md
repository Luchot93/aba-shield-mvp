# Restore test — verifying an ABA Vault backup

A backup is only real once a restore has been tested. This document describes how
to verify a `*_aba_vault.sql.gz` dump (produced by `scripts/backup.sh`) by restoring
it into a **throwaway local Postgres 17 container**.

> **Never restore into the production database.** Every command below points at a
> local scratch container on `localhost:5433`. Do not set `SUPABASE_DB_URL` or any
> production connection string in this procedure.

## Prerequisites

- Docker installed and running
- `psql` and `gunzip` available locally (PostgreSQL 17 client tools)
- A backup file to test, e.g. `../aba-vault-backups/2026-07-14_aba_vault.sql.gz`

## 1. Start a scratch Postgres 17 container

Uses port **5433** (not the default 5432) to avoid colliding with any local
Postgres, and a disposable password that only exists for this container.

```bash
docker run --name aba-restore-test \
  -e POSTGRES_PASSWORD=scratch \
  -e POSTGRES_DB=aba_restore \
  -p 5433:5432 \
  -d postgres:17
```

Wait a few seconds for it to accept connections:

```bash
until docker exec aba-restore-test pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
echo "scratch db ready"
```

## 2. Create the schemas the dump expects

The dump covers `public`, `auth`, and `storage`. `public` exists by default;
create the other two so the restore has somewhere to land.

```bash
SCRATCH_URL='postgresql://postgres:scratch@localhost:5433/aba_restore'

psql "$SCRATCH_URL" -c 'CREATE SCHEMA IF NOT EXISTS auth;'
psql "$SCRATCH_URL" -c 'CREATE SCHEMA IF NOT EXISTS storage;'
```

## 3. Restore the dump

Point `BACKUP_FILE` at the snapshot you want to verify.

```bash
BACKUP_FILE='../aba-vault-backups/2026-07-14_aba_vault.sql.gz'

gunzip -c "$BACKUP_FILE" | psql "$SCRATCH_URL" -v ON_ERROR_STOP=1
```

`ON_ERROR_STOP=1` makes psql exit non-zero on the first error, so a broken dump
fails loudly instead of silently half-restoring. A clean run with no errors is
the primary pass signal.

## 4. Verify the restored data

Spot-check that the expected tables exist and hold rows. Adjust table names to
whatever currently matters most (e.g. clients, assessment sessions).

```bash
# List restored tables per schema
psql "$SCRATCH_URL" -c "\dt public.*"
psql "$SCRATCH_URL" -c "\dt auth.*"
psql "$SCRATCH_URL" -c "\dt storage.*"

# Example row counts — replace with your real tables
psql "$SCRATCH_URL" -c 'SELECT count(*) FROM public.clients;'
psql "$SCRATCH_URL" -c 'SELECT count(*) FROM auth.users;'
```

The restore passes if:

- `gunzip | psql` completed with no errors (exit code 0)
- The expected tables are present in all three schemas
- Row counts are non-zero / consistent with what you expect from production

## 5. Tear down the scratch container

```bash
docker rm -f aba-restore-test
```

This deletes the container and all restored data — nothing persists, and
production was never touched.

## Notes

- Run this against a fresh backup periodically (e.g. monthly), not just once.
- If a restore ever fails, the backup is not trustworthy — investigate before
  relying on it. Common causes: `pg_dump` major version not matching Postgres 17,
  or a schema missing at restore time (see step 2).
