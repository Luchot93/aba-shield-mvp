# ABA Shield MVP — Project Context for Claude Code

## What This Repo Is

`aba-shield-mvp` is the production repository for ABA Shield Alpha.
It ships 4 features: Login, Clients (create + import), Initial Assessment, and AI-Generated .docx export.

This repo was extracted from `ABA_Shield_V0`. All Phase 2+ code is still present in the files
but gated behind feature flags in `src/constants/featureFlags.js`. Never delete gated code.

## What This Repo Is NOT

Do not add, reference, or assume these features exist in this repo:
- Pipeline CRM / Kanban board (FLAGS.PIPELINE — Trench 5)
- Session logging modals (FLAGS.SESSION_LOG — Trench 6)
- Reassessment workflow (FLAGS.REASSESSMENT — Trench 7)
- Staff directory (FLAGS.STAFF — Trench 8)
- Metrics dashboard (FLAGS.METRICS — Trench 9)

If you see imports from these features, check whether they are gated. If they are gated, leave them.
If they are not gated and causing errors, gate them — do not delete them.

## Feature Flags Pattern

All Phase 2 code uses this pattern:
  import { FLAGS } from '../constants/featureFlags.js'
  {FLAGS.PIPELINE && <PipelinePage />}

To enable a Phase 2 feature: set its flag to true in featureFlags.js, then fix TypeErrors.
Never set a flag to true without being explicitly asked to do so.

### FLAGS.VOICE_CAPTURE — Assessment voice recording + transcription (OFF for initial ship)

Unlike the Trench flags above, this gates an **active assessment feature** (not Phase-2 code):
AssemblyAI voice recording and transcription inside the interview. It ships **false** because
the browser hits `POST /api/transcribe`, which in dev is served by a **Vite dev-server plugin
only** (`assemblyTranscribePlugin` in `vite.config.js`) — there is **no `api/transcribe.js`
serverless function**, so the route 404s in production on Vercel.

- **Gated in two hook-safe places:**
  - `components/RecordButton.jsx` — a hook-free wrapper returns `null` when the flag is off;
    the hook-bearing `RecordButtonImpl` only mounts when on. Covers all 6 record buttons in
    `SectionCard.jsx` plus any future usage.
  - `components/SectionCard.jsx` — `hasTranscript = FLAGS.VOICE_CAPTURE && !!section.transcript`
    gates every "Show transcript" toggle + `TranscriptPanel` from one variable.
- With it off, clinicians use the existing text-notes fields; `/api/transcribe` is never called.
- **To enable:** create `api/transcribe.js` (mirror `api/generate.js`'s serverless pattern —
  see how the dev `assemblyTranscribePlugin` uploads/polls AssemblyAI), set `ASSEMBLYAI_API_KEY`
  in Vercel, then flip the flag to true. `useAssemblyToken.js` → `/api/assembly-token` is a dead
  hook (imported nowhere) — ignore it.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Tailwind CSS |
| State | React useState in App.jsx + assessmentStore.js |
| Backend | Supabase (Auth + Postgres + Storage) |
| AI drafting | Anthropic API via /api/generate serverless function |
| Voice | AssemblyAI |
| Charts | chart.js (graphs in .docx) + recharts (UI only) |
| Doc export | docx + docxtemplater + docxtemplater-image-module-free |
| Dev server | Vite (port 5175) |
| Deploy | Vercel |

## Project Structure

src/
├── App.jsx                  # Root state + page routing. Phase 2 pages are gated with FLAGS.
├── auth/                    # LoginPage.jsx, SetPasswordPage.jsx
├── components/              # NavBar (tabs gated), Avatar, StagePill, icons, ErrorBoundary
├── constants/
│   ├── featureFlags.js      # ALL flags false in Alpha. Do not change without being asked.
│   ├── seedData.js          # makeInitialSections() + makeAssessmentSession() — keep both
│   └── checklist.js        # Keep — pipeline will need it in Trench 5
├── features/
│   ├── assessment/          # ACTIVE — full 12-section interview + AI draft + .docx export
│   ├── clients/             # ACTIVE — client table, search, import CSV, new client modal
│   ├── pipeline/            # GATED (FLAGS.PIPELINE) — do not activate
│   ├── detail/              # GATED (FLAGS.PIPELINE) — do not activate
│   ├── staff/               # GATED (FLAGS.STAFF) — do not activate
│   └── metrics/             # GATED (FLAGS.METRICS) — do not activate
├── hooks/
│   ├── useAutoSave.js       # Used by assessment — keep
│   ├── useSaveStatus.js     # New in Trench 2
│   └── useAssemblyToken.js  # Used by assessment voice recording — keep
├── lib/
│   ├── supabase.js          # Supabase client — created in Trench 2
│   └── db.js                # Data access layer — grows with each trench
└── utils/
    ├── dates.js             # Keep
    ├── checklist.js         # Keep
    ├── notifications.js     # GATED — referenced only inside FLAGS.PIPELINE blocks
    └── permissions.js       # GATED — referenced only inside FLAGS.PIPELINE blocks

## Client Object Shape — Never Shrink This

Every client in the `clients` state array must have ALL of these fields,
even if they are null in Alpha. Phase 2 components expect them.

{
  id, name, dob, phone, address, gender, icd10, diagnosis,
  insurer_name, member_id, group_number, health_plan_name,
  referring_provider, referring_provider_npi, referring_provider_phone,
  referral_date, parent_name, parent_relationship, parent_email,
  preferred_language, source,
  assessment_session: null,
  // Phase 2 fields — null/empty in Alpha
  stage: null, stage_entered_at: null, auth_expiry_date: null,
  reauth_cycle: 0, pipeline_entry: false, bcba_id: null, rbt_id: null,
  service_session_logs: [], reassessment_sessions: [],
  caregiver_training_session_logs: [], documents: [], activity_log: [],
}

## Assessment Auto-Population

When a client is created (manually or via import), these client fields
auto-populate the Demographics section of the Initial Assessment:
dob, phone, address, insurer_name, member_id, group_number,
referring_provider, referral_date, gender, icd10, diagnosis,
parent_name, parent_relationship, preferred_language

This is handled by INTAKE_PROFILE_MAP in seedData.js → buildClientProfile().
Any missing fields are flagged with a yellow border in DemographicsForm.jsx.

## Assessment Draft Lifecycle — Generation, Editing, Regeneration (Cost Control)

The AI draft is the **only** paid action in the assessment. Everything else is free and must
stay free: viewing the review page, inline text edits, structured STO/behavior edits, chart/graph
rendering, and the `.docx` download (assembled locally in `generateAssessmentDoc.js`; charts via
chart.js in `chartRenderer.js`/`graphBuilder.js`; STO table sentences computed locally). Never
route a free action through `/api/generate`.

`VITE_DEMO_MODE` (default true) → local demo drafts, zero API cost. `false` → real Claude
generation. To go live: `VITE_DEMO_MODE=false` + `ANTHROPIC_API_KEY`, restart dev server.

### Change detection (so we regenerate ONLY what changed)
- **Fingerprint:** `lib/draftHash.js` (`hashString` FNV-1a, `sectionPromptHash`, `sectionPromptHashes`)
  hashes `buildSectionPrompts(session)[key]` — the exact structured inputs + notes that drive the
  AI output. The prompt string IS the fingerprint of a section's inputs.
- **Stored at generation:** `setDraftContent(setClients, clientId, key, content, state, aiOriginal, promptHash)`
  persists `generatedPromptHash` per section (Supabase JSON blob — no migration).
- **Detected on re-entry:** `sectionsWithChanges(session)` returns `[{key,title}]` where
  `draftContent` exists, a stored hash exists, and the current hash differs. Demographics is
  excluded (`EXPORT_EXCLUDED`); legacy drafts with a null hash are treated as "not changed"
  (never nag on pre-feature data).
- **Legacy backfill:** `backfillPromptHashes(setClients, clientId)` runs once when an assessment
  opens (`AssessmentFeature.jsx` useEffect) and stamps a fingerprint on any draft-bearing section
  with a null hash. **Zero AI cost** — it only stamps the current inputs so change detection has a
  baseline. Without it, legacy drafts could never surface a "changes available" flag or reach the
  regenerate button (chicken-and-egg).

### What happens when the user EDITS
- **Small text tweaks** → `InlineEditor.jsx` (`setDraftContent`, zero tokens). Prefer this over
  regeneration; never edit the downloaded `.docx` (it's disconnected and overwritten on regenerate).
- `InlineEditor` uses `useAutoSave(content, handleChange, 800)`. **Critical guard:** `handleChange`
  first-lines `if (newContent === (section?.draftContent ?? '')) return;`. `useAutoSave` fires once
  ~800ms after mount (and regenerate/backfill re-seed identical content); without this guard those
  spurious fires call `markSectionEdited` and flip an **approved** section to `'edited'`, wiping the
  approval just by landing on the review page. Only genuine edits (RichEditor passes new markdown)
  get past the guard. **Do not remove this guard.**
- **Structured edits** (behavior baseline, STO steps, skill goals) change the inputs → the section's
  prompt hash changes → it flags "Changes available". Graphs/STO tables reflect the new numbers for
  free at next download; only the AI *narrative* needs a scoped regenerate.

### Approval + regeneration flow
- Per-section `approvalState`: `'pending' | 'edited' | 'approved' | 'skipped'`. `canExport(client)`
  requires every non-`EXPORT_EXCLUDED` section be `'approved'`/`'skipped'`. Approvals persist across
  re-entry (Supabase), so a re-visit with no input changes stays fully approved → free re-download.
- Regeneration is **batched, scoped, opt-in**: one "Regenerate (N) changed sections" button (review
  page banner + checklist summary). It re-runs `/api/generate` for only the changed set
  (`generateDraft(session, { only })` / demo local path), writes new content + new hash, and resets
  those sections to `'pending'`. Untouched approved sections stay approved. No "regenerate all"
  button, no per-card button, **no token/cost language in the UI** — frame everything as
  "changes available / updated data".

### STO gate — no fabrication, no wasted tokens (all three goal types)
`sectionsMissingSTO(session)` (assessmentStore.js) returns every goal/behavior entry lacking a real
STO across **all three** types: Skill Acquisitions (`skillGoalHasSTO`), Maladaptive Behaviors
(`behaviorTargetHasSTO`), Caregiver Training (`caregiverTargetHasSTO`). Three defense-in-depth layers,
different concerns — keep all:
1. **Interview "Ready to Generate" button** (`AssessmentFeature.jsx`) — disabled when blockers exist;
   label becomes "STO required (N)", tooltip lists the entries. Stops wasted generation early and
   guides the fix inline. (UX/cost guard.)
2. **`handleGenerate` backstop** (`AssessmentChecklistPage.jsx`) — bails with the same message if a
   blocker exists. Mostly defensive given the button gate.
3. **`canExport`** (assessmentStore.js) — hard invariant: ANDs the STO check with approval state so
   no final `.docx` is ever exported with a missing/fabricated STO, regardless of navigation. This
   is the single source of truth at the last irreversible step — **not dead code**, keep it.

## db.js Pattern — One File, Grows With Each Trench

src/lib/db.js is the only Supabase query file. Never create a second db file.
Each trench adds its own functions to this file following this pattern:
- async function, throw on error, return data directly (unwrap { data, error })
- No business logic in db.js — only queries

Current functions (Trench 2):
  getClients, createClient, getAssessmentSession,
  createAssessmentSession, updateAssessmentSession

## Working Rules

1. Sessions are explicit. Announce when a session begins and ends.
2. Never auto-push to GitHub. All commits are manual.
3. No unsolicited changes. Only touch files in the scoped task.
4. Never set a FLAGS value to true unless explicitly asked.
5. Never delete files that contain gated Phase 2 code.
6. Clinical accuracy matters. Never fabricate or infer clinical data.
7. All work happens in this repo directory — not in ABA_Shield_V0.
