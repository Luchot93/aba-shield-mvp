# Infrastructure

Cloud inventory for `aba-shield-mvp` — what runs where, what it costs, and when to
upgrade. For env-var setup see [DEPLOYMENT.md](DEPLOYMENT.md); for incidents see
[RECOVERY.md](RECOVERY.md).

## Service inventory

| Service | What it runs | Plan | Dashboard | Env vars |
|---------|--------------|------|-----------|----------|
| **Vercel** | Static frontend (Vite build) + `/api/*` serverless functions (`generate`, `generate-definition`). Auto-deploys `main`. | Hobby (free) | https://vercel.com/dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_MODE` (browser); `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ASSEMBLYAI_API_KEY` (server-only) |
| **Supabase** | Project `ABA_VAULT_MVP` (ref `qravuejkiluimaihhbrf`), region `us-east-2`, Postgres 17. Provides Auth, Postgres DB (6 tables, RLS), and Storage (`assessment-documents` bucket). | Free | https://supabase.com/dashboard/project/qravuejkiluimaihhbrf | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (browser); `SUPABASE_URL`, `SUPABASE_ANON_KEY` (server); `SUPABASE_DB_URL` (backups only) |
| **Anthropic API** | AI draft generation via `/api/generate` — model `claude-sonnet-4-6`, `max_tokens: 1500`. Called **only** when `VITE_DEMO_MODE=false`. | Pay-as-you-go | https://console.anthropic.com | `ANTHROPIC_API_KEY` (server-only) |
| **AssemblyAI** | Voice recording → transcription inside the interview. **Gated** behind `FLAGS.VOICE_CAPTURE` (off for ship); no serverless route exists yet. | Free tier | https://www.assemblyai.com/dashboard | `ASSEMBLYAI_API_KEY` (server-only); `DEV_MOCK_TRANSCRIPTION`, `MAX_TRANSCRIPTION_MINUTES` (dev) |

> **Never** put a secret in a `VITE_*` var — those are compiled into the browser bundle.
> Only the Supabase anon key (safe to expose) belongs in a `VITE_*` var.

## Cost model

| Item | Cost |
|------|------|
| **Today (all free tiers, demo mode on)** | **$0 / month** |
| Per assessment, AI on (`VITE_DEMO_MODE=false`) | ≈ **$0.11** — Sonnet, ~$0.01 per section × 12 sections (measured) |
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| AssemblyAI (while gated off) | $0 |

Every non-AI action (viewing, editing, chart rendering, `.docx` export) is local and free.
The only metered spend is `/api/generate`, and only when demo mode is off.

## Upgrade triggers

| Trigger | Action | Cost |
|---------|--------|------|
| First paying customer | Vercel **Pro** (Hobby is non-commercial per ToS) | $20 / mo |
| Real clinic PHI stored | Supabase **Pro** (automated backups + no auto-pause) | $25 / mo |
| Database > 400 MB | Supabase **Pro** | $25 / mo |
| Serverless function timeouts | Vercel **Pro** (10s → 60s max duration) | $20 / mo |

## Free-tier gotchas

- **Supabase 7-day pause** — Free projects pause after ~7 days of inactivity; the app then
  loads but returns no data until someone clicks **Restore** in the dashboard (~minutes).
- **Vercel Hobby is non-commercial** — the Hobby plan's ToS forbids commercial use. Moving
  to a paying customer requires Vercel Pro (see triggers above).
- **No automated backups on free tiers** — Supabase Free has no point-in-time recovery, so
  data protection depends on the manual weekly `scripts/backup.sh` ritual until we upgrade
  to Pro. Full incident + backup procedures live in [RECOVERY.md](RECOVERY.md).
