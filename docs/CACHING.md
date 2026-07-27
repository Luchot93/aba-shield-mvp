# Caching

How ABA Shield caches, verified against production on 2026-07-23 (ACD-57, read-only audit).

## Edge & browser (Vercel)

Vercel fronts every response with its global edge CDN. Verified headers (`curl -sI` against
https://aba-shield-mvp.vercel.app):

| Resource | Cache-Control | x-vercel-cache |
|----------|---------------|----------------|
| `/` (HTML root) | `public, max-age=0, must-revalidate` | HIT |
| `/assets/index-B5wDTa8_.js` | `public, max-age=31536000, immutable` | HIT |
| `/assets/index-C3kQKu1a.css` | `public, max-age=31536000, immutable` | HIT |

All three are cached at the edge (`x-vercel-cache: HIT`) and carry an `etag`. The HTML root
revalidates cheaply via `304 Not Modified`; the content-hashed assets are now served `immutable`,
so the browser reuses them without a revalidation round-trip. Content is never stale.

**Fresh HTML — working as intended.** `must-revalidate` on the HTML root means the browser
always checks for a new version, so users pick up the latest deploy immediately.

**Hashed assets are `immutable` (fixed in ACD-65, 2026-07-27).** Content-hashed files
(`index-B5wDTa8_.js`) can safely be cached forever — a content change changes the filename — so
`vercel.json` now declares a `headers` block giving `/assets/(.*)` the value
`public, max-age=31536000, immutable`. Repeat loads and hard refreshes reuse the cached bundle
directly instead of paying a revalidation round-trip. The HTML root is deliberately left out of
that rule so it keeps revalidating and new deploys ship instantly.

## Data loading (App.jsx)

Client + assessment-session data is fetched **once per session**: a single `useEffect` runs when
the authenticated user resolves, calls `getClients()` + assessment sessions, and holds everything
in React state. No polling, no refetch on navigation.

**Staleness caveat.** Because the fetch is once-per-session, a clinician on two devices (or two
tabs) won't see the other's writes until reload. Acceptable for the single-clinician Alpha
workflow; revisit when multi-user concurrency matters (see below).

## Cost cache (draftHash.js)

The AI draft is the only paid action. `draftHash.js` fingerprints each section's prompt (an
FNV-1a hash of its structured inputs) at generation time. On re-entry we re-hash and compare, so
we **only ever regenerate the sections whose inputs actually changed** — unchanged, already-
approved sections are never re-sent to the API. This is the product's real cache: it caps token
cost, not network traffic.

## Future — do not add before FLAGS.PIPELINE

Today's fetch-once model is deliberate. **Do not add React Query, websockets, or realtime now.**
When `FLAGS.PIPELINE` flips (Trench 5 Kanban CRM), adopt per the backend plan:

- **Supabase Realtime** on the pipeline board — live stage moves across users.
- **15s polling** for detail views.

Everything else stays fetch-once until a concrete multi-user need appears.
