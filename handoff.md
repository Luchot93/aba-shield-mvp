# Session Handoff

_Last updated: 2026-10-14_

## 1. Goal we are moving towards

Ticket-driven session: [ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100)
— "Wire client documents (upload/download) to real Supabase storage + table."
The ticket's premise (filed 2026-09-29) was that the entire Documents tab was
client-side-only and every upload was lost on refresh/logout.

**Status: done.** Investigation before writing any code found the ticket's
scope was ~95% already shipped — under ACD-108 (merged 2026-09-30, one day
after ACD-100 was filed), which nobody circled back to link/close. Real gap
found and fixed: one checklist item, "Referral request form," was never
converted to the real upload path. Fixed, tested, merged to `dev` (PR #152)
then promoted to `main` (PR #153), both merged. Jira ACD-100 commented with
the plain-English explanation and moved to Done.

## 2. Current state of the code

**Merged and live on both `dev` and `main`. Local `main` and `dev`
fast-forwarded to match `origin` at session close. Nothing outstanding on
any feature branch** (`feat/ACD-100-wire-referral-form-upload`, now merged,
still exists on GitHub — not deleted, per standing feedback not to prune
branches as an automatic follow-on to a merge).

- **Already-working, confirmed by reading the code (not just the ticket)**:
  `uploadDocument()` in `src/lib/db.js` uploads to the `client-documents`
  Storage bucket and inserts into the `documents` table (`client_id, stage,
  storage_path, file_name, mime_type, uploaded_by, doc_type, field_label`);
  `getDocumentsByClientIds()` reads real rows + batch-generates signed URLs;
  the Documents tab and Download button already consumed this real data.
  `doc_type`/`field_label` columns already existed via a follow-up migration
  (`20260930174958_documents_add_doc_type_and_field_label.sql`) — the
  ticket's "add document_type column" ask was already done too.
- **The one real gap, now fixed**: `src/constants/checklist.js` — the
  `referral_form` intake checklist item was `type:'upload'`, a dead-end
  pattern wired only to a local-state helper (`pushDoc()` in
  `ClientDetailPage.jsx`) that never touched Supabase — the only document
  type in the app that still worked that way. Changed to `type:'file_upload'`
  (matching every sibling item), which routes through the real
  `pushDocUpload()` → `uploadDocument()` path.
- **Dead-code cleanup**: with `referral_form` converted, removed the
  now-zero-caller "card-style upload" render branch (`item.type === 'upload'`)
  and the `pushDoc()` helper from `ClientDetailPage.jsx`.
- **Tests updated**: `tests/pipeline.spec.js`'s two tests that drove the old
  button via `.click()` on a `data-testid="upload-referral_form"` button now
  drive the real file input (`setInputFiles`), following the same
  row-by-label-text pattern already used in `tests/upload-validation.spec.js`.
- **Verification**: `npm run build` clean. `tests/pipeline.spec.js` +
  `tests/upload-validation.spec.js`: 97 passed, 29 skipped (gated
  Metrics/Reassessment specs, expected), 0 failed.

## 3. Files actively being edited

None — everything from this session is committed, merged, and deployed.
Touched this session: `src/constants/checklist.js`,
`src/features/detail/ClientDetailPage.jsx`, `tests/pipeline.spec.js`,
and `handoff.md` itself at session close.

## 4. Everything tried that failed / walked back

- Nothing walked back this session — the scoped fix was small and landed
  clean on the first pass.
- Worth flagging as a near-miss: ACD-100 could easily have been
  re-implemented from scratch from its (stale) description alone, which
  would have duplicated ACD-108's work. Caught only by reading `db.js`,
  the migrations, and `ClientDetailPage.jsx` directly before writing any
  code, rather than trusting the ticket text as current. Worth the same
  "verify against the actual code before proposing/building" discipline on
  any older ticket that sat open a while before being picked up.

## 5. Next steps

No ticket is actively in progress. Backlog carried forward, with ACD-100
now removed (resolved this session):

1. **ACD-115** (Tailwind/Vite major-version upgrade, from ACD-94) — still
   unstarted.
2. Carried over from ACD-92 — the follow-up re-test of `manage-staff`'s
   invite happy-path once Supabase's invite emails aren't rate-limited.
   Still unstarted.
3. **ACD-101** (DNS/Resend domain verification) — still To Do, unassigned,
   still blocked on owning/controlling a real domain. Unchanged.
4. The Login-page a11y test flakiness noted in the ACD-99 QA report
   (passed in isolation, failed once in a long combined run) — not
   investigated yet; worth a look if it recurs.
5. Dependabot PR #137 (`@sentry/react` 10→11 major-version bump) merged to
   `main` previously, outside a session — still not re-verified against
   `sentry.js`'s API usage. Unchanged from prior handoffs.
6. Carried forward, unrelated pointer only (not reproduced here): the
   `openClientTab` Playwright helper bug, and everything from the ACD-82
   through ACD-98 handoffs' outstanding items (ACD-113, ACD-112, ACD-111,
   ACD-109, ACD-110, ACD-105, ACD-106) — see git history for earlier
   handoff versions if needed.
7. 4 open Dependabot dependency-bump PRs still open as of this session's
   close (#133 react-dom 18→19, #134 vite 5→8.3.4, #135
   @vitejs/plugin-react 4→6.1.2, #136 tailwindcss 3→4.3.3) — all
   major-version bumps, none reviewed or merged yet, likely overlapping
   with ACD-115's scope. Unchanged from prior handoffs.
8. GitHub's 5 Dependabot *vulnerability alerts* (1 high, 4 moderate),
   flagged on push in a prior session — user explicitly deferred
   addressing these; still worth a dedicated triage pass
   (`gh api repos/Luchot93/aba-shield-mvp/dependabot/alerts` or the repo's
   Security tab for specifics). Unchanged.
9. ACD-100's own "out of scope" follow-up, noted in its ticket
   description: a document-signature-request notification (flagging that
   a specific document, e.g. a treatment plan, is awaiting a signed
   reupload). Needs a decision on how a "reupload" gets explicitly
   represented (e.g. a `supersedes_id` or `status` column) before it can
   be built — not started.
