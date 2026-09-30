# Session Handoff

_Last updated: 2026-09-30_

## 1. Goal we are moving towards

Close out the persistence gaps left over from the pipeline-action work started
earlier: [ACD-75](https://awcbehavioralhealth.atlassian.net/browse/ACD-75)
("Wire checklist items, documents, and case notes to Supabase" — the
`ClientDetailPage.jsx` side of Trench 5 persistence), plus three specific bugs
carried forward from prior handoffs —
[ACD-103](https://awcbehavioralhealth.atlassian.net/browse/ACD-103) (missing
`SEED_CLIENTS` import crash), [ACD-104](https://awcbehavioralhealth.atlassian.net/browse/ACD-104)
("Add to pipeline" only updated local state, never Supabase), and
[ACD-108](https://awcbehavioralhealth.atlassian.net/browse/ACD-108) (the
checklist/documents/case-notes persistence ticket filed this session once the
ACD-75 gap was confirmed in code). All of this is gated Phase-2 code behind
`FLAGS.PIPELINE` (still `false` in production) — the goal was to make the
Pipeline/Client-Detail persistence layer actually correct and Supabase-backed
so it's ready whenever that flag is flipped for real, not to ship it live
this session.

**Status: shipped, merged to `main`, and all four tickets transitioned to
Done in Jira.**

## 2. Current state of the code

**Merged to `main`, live in the sense that it will deploy on Vercel's next
build — but inert in production because `FLAGS.PIPELINE` stays `false`.**

- PR [#86](https://github.com/Luchot93/aba-shield-mvp/pull/86)
  `ACD-108-checklist-documents-notes-persistence` → `dev` — merged
  (`952d0d1`).
- PR [#87](https://github.com/Luchot93/aba-shield-mvp/pull/87) `dev` → `main`
  — merged. Local `main`/`dev` fast-forwarded to match origin at session
  close; `git log origin/main..origin/dev` confirmed empty after merge.
- Commit `fe81f4f` bundled two logically distinct bodies of work that had
  both been left uncommitted in the working tree — shipped together as one
  unit rather than split retroactively (explained to the user when asked):
  - **Pass 1 (ACD-103 / ACD-104 / pipeline-action persistence)** —
    `src/App.jsx` (added the missing `SEED_CLIENTS` import — ACD-103),
    `src/features/clients/ClientsPage.jsx`,
    `src/features/pipeline/PipelinePage.jsx` (`handleSaveClient` switched
    from local-only id generation to a real `createClient` Supabase insert;
    `updateClient`/`logActivity` wired for stage advance, BCBA/RBT
    assignment, deny, and add-to-pipeline — ACD-104).
  - **Pass 2 (ACD-75 / ACD-108)** —
    `src/features/detail/ClientDetailPage.jsx` (`patchCL`, `pushDocUpload`,
    `addNote` now persist instead of only touching local state),
    `src/lib/db.js` (added `setChecklistItem`, `uploadDocument`,
    `addCaseNote`, and the batch hydration functions
    `getChecklistItemsByClientIds`, `getDocumentsByClientIds`,
    `getCaseNotesByClientIds`, `getActivityLogByClientIds`, all wired into
    `getClients`).
- Three Supabase migrations applied this session (via Supabase MCP, project
  `qravuejkiluimaihhbrf`): `checklist_items_add_value_column`,
  `create_case_notes_table`, `documents_add_doc_type_and_field_label`.
- `FLAGS.PIPELINE` confirmed still `false` in committed code. Flipped to
  `true` locally/uncommitted to QA in a browser, then reverted before
  committing — confirmed via `git diff -- src/constants/featureFlags.js`
  showing zero change post-revert.
- **Live browser QA completed** at `localhost:5175` with `FLAGS.PIPELINE`
  temporarily on: uploaded a real document via a JS-simulated file input
  (Chrome MCP's `file_upload` no longer accepts host filesystem paths in
  this environment — worked around by constructing a `File`/`DataTransfer`
  object and dispatching a native `change` event via `javascript_tool`) and
  confirmed the "Insurance card" checklist item showed "Uploaded", the
  Documents tab showed the file with correct badge/filename/date/uploader
  and a working signed-URL Download button, and a case note round-tripped
  with the author's real name ("Luis Teran") resolved from the `staff`
  table rather than a raw id/email. Did a full page reload + re-navigation
  afterward and confirmed all three (checklist state, document, case note)
  survived — i.e. genuinely persisted, not just optimistic local state.
- All four tickets (ACD-75, ACD-103, ACD-104, ACD-108) transitioned to Done
  in Jira after the user confirmed "Yes put them in done".

## 3. Files actively being edited

None in flight — everything is committed, pushed, and merged into both `dev`
and `main`, which are in sync. Working tree is clean. Next session starts
from a clean slate.

## 4. Everything tried that failed / walked back

- Nothing was walked back this session on the code itself — Pass 1 and Pass
  2 were both shipped as drafted, and QA passed on the first real attempt.
- Chrome MCP's `file_upload` tool rejected host filesystem paths partway
  through QA (a change in the tool's behavior, not a bug in this repo) —
  worked around via a JS-constructed `File`/`DataTransfer` object instead of
  giving up on live-upload QA.
- **Carried from the ACD-74 session, now resolved:** the `SEED_CLIENTS`
  missing-import crash (ACD-103) and the "Add to pipeline" no-persistence
  bug (ACD-104) were both previously deferred ("finish ACD-74 first"/"not
  touched this session") — both are now actually fixed and shipped, not
  just reverted-and-parked as before.

## 5. Next steps

1. **[ACD-100](https://awcbehavioralhealth.atlassian.net/browse/ACD-100)**
   ("Wire client documents to real Supabase storage + table") — **appears
   substantially or fully covered by this session's ACD-108 work.** Its
   three scope items: (a) wire `pushDoc()`/upload UI to Storage+table —
   done; (b) wire Documents tab list/Download to real data — done; (c) add
   a categorization column to `documents` — this session's migration added
   `doc_type`/`field_label`, but ACD-100's description literally asks for a
   column named `document_type`. Functionally equivalent, not yet
   reconciled by name. **Asked the user whether to transition ACD-100 to
   Done as well or leave it open pending that naming check — awaiting
   answer, do not close unilaterally.**
2. **[ACD-76](https://awcbehavioralhealth.atlassian.net/browse/ACD-76)** —
   write-side Staff wiring (Invite/Edit/Revoke/Bulk Import against real
   accounts). Not started.
3. **Manual QA for ACD-73** — still not done (confirm no Session Log/
   Reassessment tabs appear anywhere in the Services stage, no console
   errors, other Services-stage functionality still works). **Wait until
   the `FLAGS.PIPELINE` flip to run this check.** Carried forward.
4. **[ACD-105](https://awcbehavioralhealth.atlassian.net/browse/ACD-105)** —
   wire ACD-69's denial-tracking and staff-contact columns (backend already
   Done) into the actual frontend UI. Not started.
5. **[ACD-101](https://awcbehavioralhealth.atlassian.net/browse/ACD-101)**
   (Resend domain verification) — still blocked on DNS access to a real
   domain; per the user, pending leadership's help to unblock. Carried
   forward.
6. **[ACD-90](https://awcbehavioralhealth.atlassian.net/browse/ACD-90)**
   ("E1: Add automated tests proving staff can only see their own data") —
   still unblocked-but-pending. **Wait until the `FLAGS.PIPELINE` flip to
   test this.**
7. **[ACD-106](https://awcbehavioralhealth.atlassian.net/browse/ACD-106)** —
   CLAUDE.md's "What This Repo Is NOT" section is stale on the
   Pipeline/Trench-5 exclusion now that ACD-67/ACD-69 backend prep and this
   session's ACD-75/ACD-108 persistence work are Done. Not started.
8. **Manual QA against the ACD-67 acceptance criteria** — still outstanding
   as an action item even though the Jira ticket itself shows "Done." **Wait
   until the `FLAGS.PIPELINE` flip to confirm this.**
9. **[ACD-107](https://awcbehavioralhealth.atlassian.net/browse/ACD-107)** —
   `.github/workflows/e2e.yml` has no cache for the Playwright browser
   binary. Not started.
10. **Flip `FLAGS.STAFF` to `true` for real** — still explicitly deferred by
    the user (see ACD-74 session). Read-side behavior already validated.
    Expected to happen alongside/after the `FLAGS.PIPELINE` flip. Once
    flipped for real, do a manual Invite → Edit → Revoke pass to confirm all
    three round-trip through Supabase correctly.
11. **Flip `FLAGS.PIPELINE` to `true` for real** — the persistence layer
    (checklist, documents, case notes, pipeline-stage actions, client
    creation) is now fully Supabase-backed and QA'd with the flag
    temporarily on. Not flipped for real this session — still gated behind
    an explicit future ask, per CLAUDE.md rule 4. Several of the items above
    (3, 6, 8) are explicitly waiting on this flip to be actionable.
12. Ten stale remote-tracking branches were pruned locally this session
    (`git remote prune origin`) after confirming they were already merged
    and auto-deleted on GitHub. The corresponding **local** branches
    (`ACD-108-...` and older feature branches) were left in place — offered
    to clean them up but never got explicit confirmation. Low priority, but
    worth a `git branch -d` pass next session if the user wants a tidy local
    branch list.
