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
referring_provider, referral_date, gender, icd10, diagnosis

This is handled by INTAKE_PROFILE_MAP in seedData.js → makeAssessmentSession().
Any missing fields are flagged with a yellow border in DemographicsForm.jsx.

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
