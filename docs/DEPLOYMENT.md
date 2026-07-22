# Deployment

How `aba-shield-mvp` ships to production. Read this before deploying or rolling back.

## How a deploy happens

Production is `main`, hosted on **Vercel**. There is no manual deploy step:

1. A PR merges into `main` (see [GIT_WORKFLOW.md](GIT_WORKFLOW.md) — never commit to `main` directly).
2. Vercel detects the push, runs `npm ci && npm run build`, and deploys the output.
3. The new version is live in **~2 minutes**.

Every PR also gets a **Vercel preview URL** — verify there before merging.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production scope).
Locally they live in `.env.local` (git-ignored); see [.env.example](../.env.example) for the template.

**`VITE_` vars are compiled into the browser bundle — never put a secret in a `VITE_` var.**
Server-only vars are read by the `/api/*` serverless functions and are never exposed to the browser.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Supabase public anon key (safe to expose; never the service_role key) |
| `VITE_DEMO_MODE` | Browser | `true` = local demo drafts, zero AI cost; `false` = real Claude generation |
| `ANTHROPIC_API_KEY` | **Server only** | Claude API key — required when `VITE_DEMO_MODE=false` |

Once API-hardening lands, these are also required (server-only unless noted):

| Variable | Scope | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Server | Supabase URL for serverless auth verification |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key for serverless auth verification |
| `ASSEMBLYAI_API_KEY` | **Server only** | AssemblyAI key for voice transcription (gated behind `FLAGS.VOICE_CAPTURE`) |

After changing any env var in Vercel, **redeploy** — running deployments do not pick up new values.

## Rollback

If a deploy breaks production:

1. Vercel → **Deployments**.
2. Find the last known-good (green) deployment.
3. Open its **⋯** menu → **Promote to Production**.

Promotion is instant — no rebuild. Then fix forward on a branch and ship a new PR.

## Verify a deploy

After every production deploy, confirm the golden path by hand:

1. **Load** the production URL — the app renders, no console errors.
2. **Login** with a real account.
3. **Open a client** from the client table.
4. **Assessment loads** — open the client's Initial Assessment and confirm sections render.

If the deploy touched `api/generate.js`, `api/generate-definition.js`, or `api/_lib/verifyAuth.js`,
also run the 4 API smoke checks in [scripts/api-smoke.md](../scripts/api-smoke.md).

If any check fails, treat the deploy as **not verified** — roll back (above) and investigate.

## vercel.json rewrite rules

[`vercel.json`](../vercel.json) has two rewrites, evaluated in order:

```json
{ "source": "/api/(.*)", "destination": "/api/$1" },
{ "source": "/(.*)",     "destination": "/index.html" }
```

1. **`/api/*` → serverless functions.** Keeps API routes hitting the functions in `api/`.
2. **Everything else → `/index.html`.** SPA fallback so client-side routes (deep links, refresh)
   load the app instead of 404-ing. Order matters: the API rule must come first, or the SPA
   fallback would swallow API requests.
