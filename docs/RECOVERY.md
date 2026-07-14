# Recovery runbook — ABA Vault

Incident playbook for the ABA Vault MVP (Vercel frontend + Supabase Postgres 17).
Work top to bottom: **symptoms → first checks → fix → est. time.** When in doubt,
stop writing data first — a paused or read-only app is recoverable; overwritten
data often is not.

Status pages to keep open during any incident:
- Vercel: https://www.vercel-status.com
- Supabase: https://status.supabase.com

---

## 1. App won't load / blank page

- **Symptoms:** site returns a blank page, a Vercel error page, or won't respond.
- **First checks:**
  - Check https://www.vercel-status.com for a platform incident.
  - Open the Vercel dashboard → Deployments; look for a red (failed) build or a
    recently promoted deploy that lines up with when it broke.
- **Fix:** Deployments → find the last green (Ready) production deploy →
  **Promote to Production** (or "Rollback" on the current one). Reload once live.
- **Est. time:** ~2 minutes.

---

## 2. App loads but no data / login fails

- **Symptoms:** UI renders but lists are empty, queries hang, or login fails.
- **First checks:**
  - Check https://status.supabase.com for a platform incident.
  - Open the Supabase dashboard and check whether the project is **PAUSED** —
    free-tier projects pause after ~7 days idle and show a **Restore** button.
  - If not paused, check Auth logs (Dashboard → Logs → Auth) for errors.
- **Fix:** If paused, click **Restore** and wait for it to come back (a few
  minutes). Otherwise investigate the auth logs for the failing request.
- **Est. time:** ~5 minutes (paused restore); longer if it's an auth bug.

---

## 3. Data accidentally deleted or corrupted

- **Symptoms:** records missing, wrong, or wiped; a bad query/import ran.
- **First checks:**
  - **STOP all usage immediately.** Every additional write makes recovery
    harder. Tell users to stop entering data.
  - Identify the newest good backup: the latest `*_aba_vault.sql.gz` file in the
    private `aba-vault-backups` repo.
- **Fix:**
  1. **Verify the dump against a scratch DB first** — follow
     `scripts/restore-test.md` to restore the backup into a throwaway local
     Postgres 17 container and confirm the tables/rows look right. Never test
     against production.
  2. Once the dump is confirmed good, restore it to production with `psql`
     (using the production `SUPABASE_DB_URL` connection string).
  3. Anything entered **after** the backup date is lost — communicate the
     data-loss window to users explicitly.
- **Est. time:** ~30–60 minutes (verify + restore).

---

## 4. Bad deploy broke a feature

- **Symptoms:** app loads, but a specific feature regressed right after a deploy.
- **First checks:**
  - Vercel → Deployments; confirm which deploy introduced the regression.
  - Check the corresponding commit/PR on `main`.
- **Fix:**
  1. **Immediate:** roll back in Vercel (see scenario 1) to restore service.
  2. **Real fix:** `git revert` the offending commit on `main`, let it redeploy,
     then fix forward in a new branch/PR.
- **Est. time:** ~2 minutes to roll back; fix-forward as needed.

---

## 5. Supabase or Vercel platform outage

- **Symptoms:** errors that correlate with a status-page incident, not our code.
- **First checks:** confirm the outage on the vendor status page above.
- **Fix:** nothing to fix on our side. Monitor the status page, notify users of
  the outage and expected resolution, and resume once the vendor recovers.
- **Est. time:** dependent on the vendor.

---

## Weekly backup ritual

Every **Friday**, run the manual logical backup (~5 minutes):

```bash
SUPABASE_DB_URL='postgresql://...' bash scripts/backup.sh
```

This dumps the `public`/`auth`/`storage` schemas, gzips a
`YYYY-MM-DD_aba_vault.sql.gz` snapshot into the private `aba-vault-backups` repo,
commits + pushes it, and prunes to the most recent 12 weeks. Periodically verify
a snapshot with `scripts/restore-test.md` — a backup is only real once a restore
has been tested.

## Upgrade trigger

> The week a real clinic enters real client data, upgrade Supabase to Pro for
> automated daily backups. The manual script then becomes the secondary layer.

## Emergency contacts

- Supabase status: https://status.supabase.com
- Supabase support: https://supabase.com/dashboard/support/new
- Vercel status: https://www.vercel-status.com
- Vercel support: https://vercel.com/help
