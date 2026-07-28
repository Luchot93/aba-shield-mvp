# Error Tracking

How ABA Shield surfaces runtime errors and where to look when something breaks (ACD-61).

## Where errors go — Sentry

Frontend errors are reported to Sentry (`@sentry/react`), initialized in
[`src/lib/sentry.js`](../src/lib/sentry.js) and called at boot in [`main.jsx`](../main.jsx).

- **Project dashboard:** <!-- TODO: paste Sentry project URL --> `https://sentry.io/organizations/<org>/issues/`
- **Disabled in dev.** `initSentry()` returns early when `import.meta.env.DEV` is true or
  `VITE_SENTRY_DSN` is empty. The DSN is set only in Vercel (Preview + Production) — never
  committed. So Sentry only reports from real deploys.
- **Errors only, no perf quota:** `tracesSampleRate: 0`.

What gets captured:
- Uncaught errors + React render errors via [`ErrorBoundary.jsx`](../src/components/ErrorBoundary.jsx).
- API call-site failures via `Sentry.captureMessage` in
  [`generateDraft.js`](../src/features/assessment/lib/generateDraft.js) and
  [`SkillGoalCard.jsx`](../src/features/assessment/components/SkillGoalCard.jsx) — status + section
  key only, never prompt content.

## PHI scrubbing rules

No PHI ever leaves the browser. Enforced in `beforeSend` ([`sentry.js`](../src/lib/sentry.js)):

- **User context is UUID only** — `event.user` is reduced to `{ id }`. No name, email, or PII.
- **Request bodies stripped** — `event.request.data` is deleted (prompts/notes never sent).
- `sendDefaultPii: false`.
- Call-site captures send only `{ sectionKey, status }` — no client data, no draft text.

## Where server logs live

- **Vercel → Logs** — serverless function logs (`api/generate.js`, etc.). Free tier retains
  runtime logs for ~1 hour, so check promptly after an incident.
- **Supabase → Logs** — Postgres / Auth / Storage activity for the backend.

## Weekly habit

**Every Monday, glance at the Sentry issues list.** Triage anything new, resolve what's fixed.
A 2-minute scan catches slow-burn problems before users report them.
