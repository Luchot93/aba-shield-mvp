# Scaling

How `aba-shield-mvp` scales — and, just as important, what **not** to build. This doc exists so
future developers don't over-engineer. For the service inventory and upgrade costs see
[INFRASTRUCTURE.md](INFRASTRUCTURE.md); for cache behavior see [CACHING.md](CACHING.md).

## The model: serverless, managed, auto-scaling, $0 config

Everything runs on managed platforms that scale themselves:

- **Vercel** serves the static frontend from its global edge CDN and runs `/api/*` as serverless
  functions. Each request gets its own function instance; concurrency scales automatically. No
  servers to size, no autoscaler to tune.
- **Supabase** provides Postgres, Auth, and Storage as a managed service.

There is **nothing to configure to scale**. Growth is absorbed by the platforms until you hit a
concrete signal (table below). At that point the fix is a **plan upgrade**, not an architecture
change.

### Statelessness rule (non-negotiable for `api/` functions)

**Serverless functions must be stateless. State lives in Supabase, never in function memory.**

Each invocation may run on a fresh, isolated instance — in-memory values do not persist between
requests and are not shared across concurrent instances. So:

- No in-memory caches, counters, sessions, or queues inside `api/` handlers.
- Anything that must survive a request goes to Supabase (or is passed in the request itself).

This is what lets Vercel spin up unlimited parallel instances safely. Break it and horizontal
scaling silently breaks with it.

## Scaling signals

Don't act pre-emptively. Upgrade **only** when one of these fires:

| Signal | Where you see it | Action |
|--------|------------------|--------|
| Serverless function **timeouts** | Vercel → function logs | Vercel **Pro** (10s → 60s max duration) |
| **Bandwidth** limit hit | Vercel → Usage | Vercel **Pro** |
| **DB pressure** (size, connections, slow queries) | Supabase → Reports | Supabase **Pro** |
| **10+ clinics** onboarded | Product / onboarding | Multi-tenancy review (isolation, RLS, per-tenant limits) |

## Monthly 5-minute health check

Once a month, glance at these. It's a trend check, not a fire drill:

1. **Vercel → Usage** — bandwidth + invocation counts. Trending toward the plan limit?
2. **Supabase → Reports** — DB size, active connections, slow queries.
3. **Supabase → SQL editor** — table growth at a glance:

   ```sql
   select relname, n_live_tup from pg_stat_user_tables
   order by n_live_tup desc;
   ```

If nothing is near a limit, you're done. If a number is climbing toward a signal above, plan the
upgrade — don't wait for the outage.

## Anti-goals for the MVP stage

Do **not** add these now. Each is real infrastructure that the current scale does not justify, and
the managed platforms already cover the need:

- **No Kubernetes / container orchestration** — there are no long-running servers to orchestrate.
  Vercel functions are the deploy unit; orchestration solves a problem we don't have.
- **No dedicated servers** — a server you rent 24/7 is a fixed cost and an ops burden. Serverless
  scales to zero and to peak on its own.
- **No Redis / external cache** — would violate the statelessness rule and add a service to run.
  The real cost cache already lives in `draftHash.js` (see [CACHING.md](CACHING.md)); Postgres
  handles the rest.
- **No read replicas** — a single Postgres instance is nowhere near capacity. Replicas add
  consistency complexity to solve read load we don't have.

**The rule:** scale doesn't justify the complexity. Revisit any of these **only** when a listed
scaling signal actually fires — not before.
