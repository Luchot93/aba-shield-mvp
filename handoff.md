# Session Handoff

_Last updated: 2026-09-29_

## 1. Goal we are moving towards

[ACD-70](https://awcbehavioralhealth.atlassian.net/browse/ACD-70) ("A4: Send
real emails for stage changes, checklist completions, and
authorization-expiry warnings"). Notifications previously only showed up
in-app; this session added real email delivery via Resend on top of that
(additive, in-app list unchanged), plus a daily cron for the 30/14-day
authorization-expiry warnings.

Problem it solves: staff had no way to be notified of a client stage change
or an approaching reauthorization deadline unless they were actively looking
at the app. Two pieces:
1. **Stage-change emails** — fires on advance/deny/resubmit, to the assigned
   BCBA/RBT + all admins.
2. **Auth-expiry cron** — Vercel Cron, daily, emails staff exactly 30 and 14
   days before `auth_expiry_date` (exact-date match, not `<=`, so each client
   gets exactly one email per threshold with no dedup bookkeeping needed).

Both are backend prep for `FLAGS.PIPELINE` (still off in production) — same
pattern as the last several sessions (ACD-67 → ACD-68 → ACD-69 → **ACD-70**).
`auth_expiry_date` is only ever set once Pipeline activates, so the cron will
find zero matches in production today; it's built now so it's ready and
testable ahead of that flip.

**Status: code shipped and merged to `main`.** Real email delivery is
**untested end-to-end** — see §4.

## 2. Current state of the code

**Merged to `main`, live in the sense that it will deploy on Vercel's next
build** — not yet manually verified against a live production request (see
§5 next steps).

- PR [#73](https://github.com/Luchot93/aba-shield-mvp/pull/73)
  `ACD-70-real-email-notifications` → `dev` — merged.
- PR [#74](https://github.com/Luchot93/aba-shield-mvp/pull/74) `dev` → `main`
  — merged. Confirmed `main`/`dev` byte-identical (`git diff origin/main..
  origin/dev` empty) after merge; local `main`/`dev` fast-forwarded to match.
- New Supabase edge function `supabase/functions/send-notification-email/
  index.ts` — sends via Resend, logs every attempt (sent/failed) to a new
  `email_notifications` table (migration
  `20260929100000_email_notifications_table.sql`). RLS: staff can only read
  their own rows; write access is service-role only (no anon/authenticated
  insert policy, matching the `profiles`-table pattern elsewhere).
- `src/utils/notifications.js`: `sendStageChangeEmail()` — fire-and-forget,
  swallows failures so a failed send never blocks the UI action that
  triggered it. Wired into `ClientDetailPage.jsx`'s advance/deny/resubmit
  flows alongside the existing in-app `addNotif()` calls.
- New `api/check-auth-expiry.js` (Vercel serverless function) + `vercel.json`
  cron entry (`"0 3 * * *"`). Uses `SUPABASE_SERVICE_ROLE_KEY` directly
  (cross-user DB reads the anon key can't do). Protected by `CRON_SECRET`,
  which Vercel sends automatically as `Authorization: Bearer $CRON_SECRET`
  for configured cron invocations. Reuses `send-notification-email` for the
  actual send, same as the frontend path.
- `src/App.jsx`: the old demo-data seed-notification `useEffect` (hardcoded
  date, in-app-only) is commented as superseded by the real cron once
  Pipeline activates — left in place, not deleted, per "never delete gated
  code."
- `.env.example` documents the three new server-side vars: `SUPABASE_URL`
  (bare, unprefixed — read server-side by `api/*.js`), `SUPABASE_SERVICE_
  ROLE_KEY`, `CRON_SECRET`.
- Confirmed via Vercel MCP: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_URL` are all set correctly in the Vercel project's env vars with
  correct scoping (production/preview/development as appropriate).

**Two Jira scope gaps found and resolved this session** (ACD-70's AC text
predates what was actually decided/built):
- **"Document-signature request"** trigger — split out entirely. Investigated
  the `documents` table/upload flow and found it's **not wired to Supabase at
  all** — uploads are pure local React state (`pushDoc()` in
  `ClientDetailPage.jsx`), never persisted. Created
  [ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100) ("Wire
  client documents to real Supabase storage + table"), linked as **Blocks**
  ACD-70, since a signature-request notification is meaningless until
  documents actually persist.
- **"Checklist completion"** trigger — not built (stage-change was built
  instead, a scope substitution). Commented on ACD-70: not needed at this
  level, deferred for later evaluation.

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync. Working tree is clean. Next session starts
from a clean slate.

## 4. Everything tried that failed / walked back

- **Resend domain verification is blocked.** `FROM_ADDRESS` in the edge
  function points at a placeholder domain (`ourclinic-domain.com`) that we
  don't own, so every real send attempt gets `403 domain is not verified`
  from Resend. This is correctly logged as `status: 'failed'` in
  `email_notifications` — nothing is silently dropped — but **no real email
  has ever been sent or received end-to-end**, for either the stage-change
  path or the cron path. User explicitly decided: don't try to fix this now
  (we don't own a real domain to point DNS at yet), ship the code, test later
  once DNS is available. Tracked as its own ticket:
  [ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)
  ("Verify a real sending domain in Resend"), commented on ACD-70 with the
  caveat.
- Considered `pg_cron` (Supabase-side scheduling) for the auth-expiry job,
  rejected in favor of Vercel Cron — not enabled on the project, and Vercel
  Cron fits the existing serverless-function convention (`api/generate.js`,
  `api/_lib/`) without introducing new Supabase infrastructure.
- Considered `<=30 days` for the expiry query, rejected in favor of exact
  date-equality (`= today+30`) — avoids a client getting the same email
  repeated on every day it's "within" the window, with no extra "already
  notified" table needed.
- Reused the existing `send-notification-email` edge function from a second
  caller (`api/check-auth-expiry.js`) rather than duplicating send logic —
  works because a service-role key is itself a valid JWT, satisfying the
  edge function's `verify_jwt: true`.

## 5. Next steps

1. **ACD-101 (Resend domain verification)** — blocked until DNS access to a
   real domain is available. Once ready: add the domain in Resend, add the
   SPF/DKIM/DMARC records, wait for verification, update `FROM_ADDRESS`,
   then trigger one real stage change and confirm delivery + a `'sent'` row
   in `email_notifications`.
2. **Live-test the cron** once deployed: `curl` `/api/check-auth-expiry` with
   `Authorization: Bearer $CRON_SECRET` against production, expect
   `{"sent":0,"failed":0}` (correct — no real client has `auth_expiry_date`
   set yet since Pipeline is off).
3. **ACD-100 (wire documents to real Supabase storage + table)** — not
   started. Needed before any document-signature-request notification is
   buildable. Also needed for its own sake: uploaded documents currently
   vanish on refresh/logout since nothing persists them.
4. **ACD-69 frontend wiring** (no ticket number yet, unstarted, carried
   forward again) — `updateClient()`/staff persistence functions still don't
   exist in `db.js`; denial fields and staff invites still won't survive a
   refresh. Confirm with the user whether this becomes its own Jira ticket
   before starting.
5. **ACD-90** ("E1: Add automated tests proving staff can only see their own
   data") — still unblocked and pending, carried forward from prior
   sessions.
6. **CLAUDE.md is still stale** on the Pipeline/Trench-5 exclusion — still
   flagged, not actioned, carried forward unchanged.
7. **Manual QA against the ACD-67 acceptance criteria** (admin sees all
   clients, BCBA/RBT see only assigned, non-admin reassignment rejected,
   Staff Directory loads) — still outstanding, carried forward again.
