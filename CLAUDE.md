# ABA Shield — Project Context for Claude Code

## What This Product Is

**ABA Shield** is a SaaS platform for ABA (Applied Behavior Analysis) clinics. It digitizes and streamlines the full client lifecycle — from intake through authorization, assessment, treatment plan drafting, service delivery, and reauthorization.

**Core value propositions:**
- For clinic owners/admins: real-time pipeline visibility and documentation guardrails that prevent compliance errors before billing or audits.
- For BCBAs: eliminates double-entry by capturing assessment interview data once and generating AI-drafted treatment plans from it. Assessment + plan creation goes from ~3.5 hours to ~35 minutes.

---

## Primary Users & Roles

| Role | Responsibilities |
|------|----------------|
| **Admin / Operations** | Pipeline management, case assignment, staff invite, credential oversight |
| **BCBA** | Assessment (CPT 97151), treatment plan authoring, RBT supervision (97155), caregiver training (97156), reauthorization |
| **BCaBA** | Clinical support under BCBA supervision |
| **RBT** | Direct 1:1 therapy delivery (97153), session data collection, protocol implementation |

Authority boundaries are strict: RBTs cannot modify treatment plans or make clinical decisions independently. BCBAs are the named provider on all insurance submissions.

---

## The Happy Path (Full Workflow)

1. Admin creates a **client record** (+ New Client or CSV import)
2. Client enters the **Pipeline** at Intake stage
3. BCBA is assigned; admin uploads intake documents; client advances through stages
4. At **Assessment stage**: BCBA runs the Smart Assessment interview, generates AI draft, reviews and approves all 12 sections
5. The AI draft generates graphs for skill acquisitions, maladaptive behaviors, and caregiver training
6. **Vineland-3 and BASC-3 graphs cannot be generated** — these come from third-party tools. BCBA adds them manually to the draft outside the platform, then uploads the **final signed treatment plan** in Plan Draft stage
7. At **Plan Draft**: BCBA reviews the AI-generated content (goals, behaviors, interventions, CPT hours, graphs), marks it approved, uploads the signed final document
8. Client advances through Submitted → (Denied if rejected, with appeal flow) → Authorized → Staffing → In Services
9. In **Services**: reauthorization cycle triggers every 6 months; BCBA uploads updated graphs, progress report, and Vineland/BASC updates

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Tailwind CSS |
| State management | React `useState` in `App.jsx` + helper functions in `assessmentStore.js` (no Zustand) |
| Backend / DB | Local seed state — no backend yet (Supabase integration is planned post-approval) |
| Auth | Custom (`LoginPage`, `SetPasswordPage`) |
| Voice transcription | AssemblyAI |
| Charts | chart.js + recharts |
| Doc export | docx + docxtemplater |
| Dev server | Vite (port 5175) |

---

## Project Structure

```
src/
├── App.jsx                   # Root: all React state + page routing
├── auth/                     LoginPage, SetPasswordPage
├── components/               NavBar, Avatar, StagePill, icons
├── constants/                stages.js, seedData.js, checklist.js
├── features/
│   ├── pipeline/             Kanban board (9-stage CRM)
│   ├── clients/              Client table + CSV import
│   ├── staff/                Staff directory
│   ├── detail/               Client detail page + plan draft  ← stage checklists live here
│   ├── assessment/           Smart assessment interview + AI draft
│   └── metrics/              Metrics dashboard
├── hooks/
└── utils/
```

---

## Metrics Page (Home/Default)

**KPI Row 1:** Stalled cases (past per-stage threshold, % of active clients) | Reauth at risk (≤30 days, target 0) | Expiring certs (≤60 days, target 0) | Cert compliance (target 100%) | Avg intake→services days (target <28d) | Caregiver training documented (X/Y, target 100% before submission)

**KPI Row 2 — Operational Alerts:** Reauth in progress | Missing BCBA (target 0) | Missing RBT (target 0) | Denial rate (target <10%)

**Charts:** Clients by pipeline stage (bar across 9 stages) | Stuck cases by stage (bar, thresholds: Intake 7d, Auth 14d, Assessment 21d, Plan 14d, Submitted 21d)

---

## Pipeline / CRM

### 9 Kanban Columns
Intake → Auth 97151 → Assessment → Plan Draft → Submitted → Denied → Authorized → Staffing → In Services

**Pipeline filters (top bar):** Active (total) | Blocked (count) | Denied (count) | Reauth ≤30 days (count)

**View filters:** All | Blockers only | My cases | Search by name

### Client Card (on board)
Shows: client name, insurer, BCBA avatar+name dropdown (Change inline), RBT dropdown (Staffing/Services only), day counter, items missing alert chip.
- **Denied cards**: show denial reason + "Ready to advance" chip when resolved
- **Services cards**: "Services · Reauth" label + "Reauth in X days" banner (negative = overdue)

### Client Detail Page
Full-page view (not a slide-over). Header: avatar, name, DOB · insurer · member ID, stage pill, BCBA assigned (Change link), RBT assigned (Change link, appears from Authorized onwards).

**Breadcrumb:** Shows all 9 stages in order. Completed stages show ✓. Current stage is highlighted. Clicking future stages does NOT navigate — it is display-only.

**Right panel tabs:**
- **Notes** — free-text case notes with timestamp + role + stage tag; Add Note button
- **Documents** — all uploaded files categorized by type (REFERRAL FORM, INSURANCE CARD, CDE, ABA PRESCRIPTION, PRIOR ASSESSMENTS, DRAFT, FINAL, etc.) with stage they were uploaded at + Download button
- **Activity** — count badge; timestamped log of all actions
- **Plan** — appears from Plan Draft onwards; shows FINAL and DRAFT versions of the treatment plan document + the full inline approved AI-review content (Medical Necessity, skill goals, behavior goals, etc.)

---

## Stage Checklists (what's required to advance each stage)

### Stage 1: Intake → Auth Assessment (13 items)
**Uploads:** Referral request form | Insurance card | Comprehensive Diagnostic Evaluation (CDE) | ABA prescription/script | Intake consent packet signed
**Auto-filled fields (from client record, confirm+save):** Client demographics | Referral source | Insurance plan name | Member ID / Group # | Copay/deductible details | Preferred language
**Checkboxes:** Insurance information verified | Benefits verification completed

### Stage 2: Auth Assessment → Assessment (13 items)
**Status badges (not uploaded yet):** CDE confirmed | ABA prescription confirmed | Referral form confirmed
**Upload:** Prior assessments attached
**Checkbox:** Authorization submitted to insurer
**Submission Details fields:** Submission date | CPT 97151 units requested | Expected response date | Submission method/portal (e.g. Availity, fax, phone) | Submission reference number
**Checkboxes:** CPT 97151 authorization received | BCBA assigned to case
**Special button:** "Mark as Denied" (sends client to Denied stage, records "Auth Assessment" as source for return routing)

### Stage 3: Assessment → Plan Draft (12 items)
**Auto-populated:** BCBA assigned and confirmed
**Smart Assessment link:** "Continue Smart Assessment →" (opens the 12-section interview)
**Fields:** Caregiver interview completed (voice recording status) | Direct observation completed | Observation session date
**Checkboxes:** Vineland-3 administered within 12 months | BASC-3 administered within 12 months
**Free text:** Additional assessments completed | Additional tools used
**Auto-populated from assessment:** Behaviors identified (count) | Baseline behavioral data recorded (count with baseline)
**Upload:** Final assessment report uploaded

### Stage 4: Plan Draft → Submitted (15 items)
**Generated from assessment (read-only, expandable):**
- Medical necessity statement (with "Show full narrative" toggle)
- Skill-acquisition targets (G1–Gn with baseline % → target %)
- Behavior-reduction goals (B1–Bn with baseline count → target)
- Intervention strategies (per goal: DTT, NET, FCT, Social Stories, Video Modeling, etc.)
- Baseline graphs: "Baseline vs Target" + "STO Trajectory" per behavior; "Skill Goals · Behaviors"; "Caregiver · Premack"; "Caregiver · Reinforcement"

**CPT hours (editable, save):** 97153 direct hours/mo | 97155 BCBA hours/mo | 97156 caregiver hours/mo
**Plan fields:** Data-collection methodology | Plan period start/end dates | Sessions per week | Session duration (minutes)
**Mandatory checkbox:** AI draft reviewed and approved by BCBA
**Upload (mandatory):** Signed treatment plan
**⚠ Note on graphs:** The AI generates graphs for skill acquisitions, maladaptive behaviors, and caregiver training baselines. Vineland-3 and BASC-3 graphs are NOT generated — these come from third-party tools. The BCBA downloads the AI draft, manually adds Vineland/BASC graphs outside the platform, then uploads the final signed document here.

### Stage 5: Submitted → Authorized (11 items)
**Checkbox:** Treatment plan submitted
**Field:** Plan submission date
**Display:** CPT units included (e.g. "97153: 80h · 97155: 12h · 97156: 8h")
**Section — Authorization Received:**
  Upload: Authorization approval document
  Field: Authorization reference number
  Fields (pre-filled from Plan Draft, confirm+save): Authorized 97153 hours | Authorized 97155 hours | Authorized 97156 hours
  Fields: Authorization period start | Authorization period end (with "Suggest 6-month period" helper)
**Special button:** "Mark as Denied" (sends client to Denied stage, records "Submitted" as source for return routing)

### Stage 6: Denied — Resolution Checklist (8 items)
**Fields:** Denial received date | Denial code | Appeal deadline | Denial reason logged (pre-filled from the denial reason entered at time of marking)
**Checkboxes:** Peer-to-peer scheduled within 2 days (shows peer-to-peer phone number inline as helper text) | Peer-to-peer completed or appeal submitted
**Upload:** Supporting documentation
**Field:** Appeal outcome (placeholder: "Approved / Upheld / Pending")
**Source-aware return routing — the return button label and destination depend on where the denial originated:**
- Denied from **Auth Assessment** → button: **"Return to Auth Assessment →"** — client goes back to Auth Assessment stage
- Denied from **Submitted** → button: **"Return to Submitted →"** — client goes back to Submitted stage; auth fields are cleared for the new submission, previous values saved as reference

**On the pipeline card**, denied cards show a "from Auth Assessment" or similar badge to indicate the source stage.
**Confirmation modal:** Clicking "Mark as Denied" opens a modal — "Move [Client Name] to the Denied stage. This will be logged in the activity history." — with an optional free-text DENIAL REASON field, and Cancel / Confirm Denial buttons.

### Stage 7: Authorized → Staffing (7 items)
**Display:** BCBA matches insurance authorization (shows BCBA name + NPI, "verify both match the authorization letter")
**Checkbox:** BCBA credentials verified
**Display:** RBT assigned (name + Change link)
**Display:** RBT certification valid (expiry date)
**Display:** RBT credentials attached (cert # on file)
**Fields:** Weekly session schedule | Session location

### Stage 8: Staffing → In Services (7 items)
**Checkboxes:** Caregiver availability confirmed | Staff schedule coordinated | First session scheduled
**Fields:** First session date | First session time | Session location
**Checkbox:** First session completed

### Stage 9: In Services — Reauthorization Cycle (9 items)
**Banner:** "↻ Reauthorization cycle active · Auth expires [date]"
**Uploads:** Progress report | Updated behavioral graphs
**Checkboxes:** Vineland-3 updated | BASC-3 updated | Reauth submitted
**Fields:** Reauth submission date | 97153 hours used this auth period | 97155 hours used this auth period | 97156 hours used this auth period

---

## Assessment Feature — Key Concepts

### STO / LTO (Short-Term Objectives / Long-Term Objectives)
Structured clinical goal tables. BCBAs define explicit milestone steps per goal; auto-formula fallbacks are used when no steps are entered.

#### Skill Acquisition Goals — `stoSteps[]`
Shape: `{ id, targetPercent, skillDescription, durationWeeks }`
- **Tier 0** — BCBA-defined multi-step milestones (`stoSteps[]`)
- **Tier 1** — legacy single-step fields (`stoPercent`, `stoSkillDescription`, `stoWeeks`)
- **Tier 2** — legacy free-text (`goal.sto`)
- **Tier 3** — auto-formula: single midpoint between baseline and mastery
- `masteryCriteriaPercent` on the goal root = LTO mastery target

#### Behavior Targets — `stoSteps[]`
Shape: `{ id, targetFrequency, durationWeeks, note }`
- Same 4-tier hierarchy; `targetFrequency` is a count (not %)
- When no steps defined, chart auto-interpolates 9 evenly-spaced reduction steps

#### Downstream consumers (both goal types)
| Consumer | Behavior stoSteps | Skill stoSteps |
|---|---|---|
| Interview card | BehaviorTargetCard.jsx | SkillGoalCard.jsx |
| AI Review editor | MaladaptiveBehaviorsEditor.jsx | SkillAcquisitionsEditor.jsx |
| Review view table | MaladaptiveBehaviorsReviewView.jsx | SkillAcquisitionsReviewView.jsx |
| DOCX export | generateAssessmentDoc.js `computeBtSTO()` | generateAssessmentDoc.js `computeSkillSTO()` |
| AI section prompt | buildSectionPrompts.js `buildBehaviorTargets()` | buildSectionPrompts.js `buildSkillAcquisitions()` |
| Charts | graphBuilder.js → `renderSTOTrajectoryChart` | graphBuilder.js → `renderSkillSTOChart` |
| Plan Draft panel | PlanDraftInlinePanel.jsx `BehaviorGoalsPanel` | PlanDraftInlinePanel.jsx `SkillTargetsPanel` |

#### Plan Draft Pipeline Panel — STO Milestone Rail
`PlanDraftInlinePanel.jsx` surfaces STOs in the Plan Draft stage checklist:
- Each skill/behavior card has a **`▾ N STOs`** chip (teal for skills, rose for behaviors)
- Clicking expands an inline horizontal milestone rail: Baseline → STO 1 → … → LTO
- Shows exact BCBA-entered values + week durations; falls back to auto-midpoint with "(auto)" label
- Independent expand state per card

### Caregiver Training Graphs
The AI generates graphs dynamically from observed baseline % values entered in Section 11 (Caregiver Training). Two modes:
- **Dynamic (new):** If `caregiverTrainingTargets[]` are defined on the session, one chart per target is generated via `renderCaregiverTrainingTargetChart()` in `graphBuilder.js`
- **Legacy fallback:** If no targets defined, falls back to hardcoded Premack Principle + Reinforcement Delivery charts using `caregiverBaselines.premack_baseline` and `caregiverBaselines.reinforcement_baseline`

`makeStandardCaregiverTargets({ premack, reinforcement }, clientId)` in `seedData.js` creates the standard two-target structure for seed clients.

---

## Assessment List Page

Statuses: In progress | In review | Completed
Card: client name, BCBA, progress bar, X/12 sections captured/approved, mic+edit icons, CTA (Continue → / Review → / View).
The counter shows X/11 when Caregiver Training (section 11) has no data; shows 12/12 when fully complete.

### Phase 1 — Interview Capture (12 Sections)
Left sidebar: all 12 sections, color-coded status dots (green=complete, amber=partial, empty=none).
Top right: "Ready to Generate →" button (always active).
Continuous auto-save. No forced section order.

**Sections:**
1. **Demographics & Referral Info** — structured form: client name, DOB, gender, diagnosis, ICD-10, phone, address, insurance carrier, member ID, group #, Medicaid ID, referring provider, referral date, assessment date
2. **Presenting Concerns** — guided prompts + free-text + voice recording
3. **Self-Help Skills** — guided prompts + free-text
4. **Daily Living Skills** — guided prompts + free-text
5. **Safety Concerns** — guided prompts + free-text + voice recording
6. **Communication** — guided prompts + free-text + voice recording
7. **Self-Stimulatory Behavior** — guided prompts + free-text
8. **Medical Necessity** — guided prompts + free-text + voice recording
9. **Maladaptive Behaviors** — structured: "Behavior Targets" list, each entry has name, function tag (Automatic/Escape/Attention/Tangible), severity tag (Severe/Moderate/Mild); "+ Add behavior"
10. **Skill Acquisitions** — structured: "Skill Goals" list, each entry has goal name, domain category tag (Communication/Academic/Motor/Adaptive/Self-Help); "+ Add goal"
11. **Caregiver Training** — guided prompts (Training Readiness, Barriers & Support), BCBA Clinical Notes (amber box), Observed Baselines (Premack Principle % + Reinforcement Delivery %), Training Format toggles, Training Frequency toggles, Barriers to Participation text, Caregiver Strengths text, voice recording, Clinical Notes free-text
12. **Crisis Plan** — guided prompts + free-text + voice recording

### Phase 2 — Pre-Generation Checklist
Full-page. Summary bar: X complete | X partial | X empty | X/12 sections have data.
Info: "Empty sections will be skipped. Partial sections will be drafted with available data and flagged for review. The AI will not invent clinical information."
Each section row: number, name, status summary, data type chips (rec / notes / targets / goals / data), chevron to jump back to that section.
Section 1 special status: "Pre-filled from client record — ready for assessment."
Section 8 special status: "Draft ready — awaiting your review."
Bottom: "Generate Assessment Draft" button.

### Phase 3 — AI Review Document
Generation time ~5-8 seconds ("Formatting document sections..." progress bar).
Status changes to IN REVIEW. Header: "Assessment Document — Review each section, edit as needed, then approve. Export when all sections are reviewed."
Progress bar: "0/11 sections reviewed" (yellow → green as approved).
Top right: "⬇ X sections pending" export button — **disabled until ALL sections approved**.
Each section has:
- "EDITED" badge if previously modified
- AI-generated clinical prose with bold field labels
- Inline pencil edit icon per content block
- "SOURCED FROM" chips: Transcript / Clinical notes / Structured form
- **Skip** and **✓ Approve** buttons

Export produces a `.docx` matching the Initial Assessment Template format.

---

## Clients Page (Table View)
Columns: Avatar+Name, DOB/Age, Insurer, Member ID, Stage pill, Care Team, Referral Date.
Filters: All | Intake | In Progress | Active Services | Denied | Directory.
Actions: Import CSV/Excel, + New Client.
Clicking a row opens a **slide-over panel**: diagnosis, ICD-10, parent/guardian (name, phone, email, address), insurance details, referring provider + NPI, care team, created date.

---

## Staff Page
Card grid. Stats bar: Active Staff | Total Cases | Cert Expiring (within 60 days) | Invite Pending.
Filters: All | BCBAs (n) | RBTs (n) | Active | Cert expiring | Search by name/cert#/NPI.
Clicking a card expands inline: title, email, phone, joined date, credentials (cert #, effective, expires, NPI).
Expiring cert shown as colored badge (e.g. "Expiring Jul 4, 2026").
Actions: Import Staff, + Invite Staff.

---

## Insurance / CPT Reference

| CPT Code | Service |
|----------|---------|
| 97151 | Behavioral assessment (BCBA-led) |
| 97153 | Direct ABA therapy (RBT) |
| 97155 | BCBA supervision |
| 97156 | Caregiver/family training |

Key payers in scope: BCBS (via Lucet/WebPass), Cigna/Evernorth, Sunshine Health / Children's Medical Services, Aetna, UnitedHealth, Humana, Florida Blue.

---

## Completed Work (this branch)

**feat/reassessment-workflow-pt4-client-view** — Reassessment Cycle Summary Panel in Client Detail View

### Track 1: ReassessmentCyclePanel.jsx — new component
`src/features/detail/ReassessmentCyclePanel.jsx` — full read-only clinical summary panel rendered below each reassessment cycle card in the Reassessment tab:
- **Section A — Maladaptive Behaviors**: Mastered (emerald row + mastery date), Continuing in new cycle (collapsible card with DualBaseline widget, STO milestone rail, progress chart), New/Emerging (IN PLAN / MONITOR ONLY / EXCLUDED badges)
- **Section B — Skill Acquisitions**: same three-bucket structure; skill domain chip; STO rail reads `masteryCriteriaPercent` from plan skill goal as LTO
- **Section C — Caregiver Training**: same structure; STO rail reads `ltoPercent`/`ltoSessions` from CT target as LTO
- **STO Milestone Rail** (`ReassessmentStoRail`): horizontal node rail — Current STO (teal ring) → remaining STOs → LTO node (teal filled); shows "STO/LTO not defined" placeholder when empty
- **Progress charts**: Recharts `LineChart` per item — actual session trend vs initial baseline (dashed) + new-cycle baseline (orange) + LTO target (teal); color-coded improving/declining footer
- **Locked placeholder**: when `session.status !== 'complete'`, renders a lock icon panel instead of clinical data — BCBA must download the reassessment doc first
- **Graph spinner**: teal pulse skeleton while `graphs` prop is still loading

### Track 2: ClientDetailPage.jsx — wiring
`src/features/detail/ClientDetailPage.jsx`:
- Added `reassessmentGraphs` state + `useEffect` (triggered when `servicesTab === 'reassessment'`): calls `buildGraphsFromSession` with the most recent reassessment session and sets state
- Renders `<ReassessmentCyclePanel>` below each cycle card, passing `session`, `client`, and `graphs`

### Track 3: Sofia Ramirez (c15) — completed-reassessment demo client
`src/constants/seedData.js`:
- Added full `c15` client record (Sofia Ramirez, Florida Blue, In Services, 6-year-old)
- `C15_BEHAVIOR_TARGETS` — 3 original behaviors (Aggression, Self-Injurious Behavior, Tantrum) with stoSteps; Property Destruction added as formal behavior target in `sections.behavior_targets.behaviorTargets` with 3 STOs and operational definition (data traceable to reassessment form, not hardcoded)
- `C15_SKILL_GOALS` — 3 skill goals (Functional Communication/AAC, Motor Imitation, Self-Care: Handwashing) with `targetSkill` field (correct field name)
- `C15_CT_TARGETS` — 2 CT goals (Reinforcement Delivery, Prompt Hierarchy Implementation) with `ltoPercent` + `ltoSessions` so `makeReassessmentSession` can build `ltoData`
- `C15_SERVICE_LOGS` — 8 behavior sessions (14 entries each), 8 skill sessions, 6 CT sessions with `accuracyPercent` (correct field name)
- `reassessment_cycle1_sofia` — status `'complete'` so the full clinical panel renders (vs Charlotte Davis which is `'in_progress'` and shows the locked placeholder)

### Track 4: makeReassessmentSession — systemic data propagation fixes
`src/constants/seedData.js` — `makeReassessmentSession()`:
- **`includedInPlan` + `monitorOnly`** now propagated from the first `isNew: true` log entry into `newBehaviorSummary` and `newSkillSummary` (previously always hardcoded to `null`, causing all new items to show EXCLUDED)
- **`monitorOnly`** added to `seenSkills.set()` record and `newSkillSummary` return object
- These fixes apply to all clients, not just c15

### Previous completed work (prior sessions on this branch)

**feat/reassessment-workflow-part-3** — Purpose-built reassessment DOCX export + progress UI hardening

### Track 1: Read-only average inputs in Reassessment Interview
`AssessmentInterviewPage.jsx` — `OrigBehaviorRow`, `OrigSkillRow`, `CaregiverTrainingSummaryRow`:
- Removed editable `<input>` fields for average frequency/accuracy/session % — these values are computed from session logs and must never be manually overridden
- Replaced with plain read-only display: `averageFrequency`, `averageAccuracy`, `averageSessionPercent` rendered as static text
- Removed `localAvg` / `localCurrent` useState + useEffect + blur handlers from all three components

### Track 2: "Excluded" disposition shown in Reassessment Review Page
`ReassessmentReviewPage.jsx` — new/emerging items sections for behaviors, skills, and caregiver training:
- Added `ExcludedBehaviorRow`, `ExcludedSkillRow`, `ExcludedCaregiverRow` components with stone "EXCLUDED" badge
- Items where neither `includedInPlan` nor `monitorOnly` is set now appear with muted styling for full transparency
- Caregiver section IIFE guard fixed: `inPlanCT.length === 0 && monitorCT.length === 0` → `newCaregiverItems.length === 0` (prevented excluded-only items from hiding the section)

### Track 3: Two separate DOCX export functions
`generateAssessmentDoc.js`:
- **`generateInitialAssessmentDoc`** — alias for the original `generateAssessmentDoc` (initial assessment doc fully unchanged)
- **`generateReassessmentDoc(session, clientName, sessionLogs, ctLogs)`** — new purpose-built export for the reauthorization document
- 24-section clinical structure: Identification → Executive Summary → Clinical Background (7 sections with provenance notes) → Medical Necessity → Strengths → Areas → Progress (behavior/skill/CT) → Interventions → New Cycle Plan (4 buckets × 3 domains) → Crisis Plan → Placeholders → Signature
- `ReassessmentReviewPage.jsx` updated to import and call `generateReassessmentDoc` with `sessionLogs` and `ctLogs`

### Track 4: Progress charts for reassessment (`graphBuilder.js`)
- `buildGraphsFromSession` signature updated to accept `{ sessionLogs, ctLogs }` second arg (backwards-compatible default `{}`)
- New Step 6: generates `progress_behavior_${key}`, `progress_skill_${key}`, `progress_ct_${key}` charts — session-by-session actual trend lines using `buildBehaviorTrendFromLogs` / `buildSkillTrendFromLogs`
- `renderProgressLineChart(entries, baseline, title, opts)` helper: Chart.js line chart with green/red coloring based on direction of change, dashed baseline reference line, canvas → base64 PNG

### Track 5: Reassessment DOCX — clinical section helpers
Nine new helper functions added to `generateAssessmentDoc.js`:
- `reassessmentTitleBlock` — "RE-ASSESSMENT REPORT / Progress Report & New Authorization Cycle Treatment Plan"
- `executiveSummarySection` — BCBA narrative (`progressNarrativeText`) with action-required placeholder
- `reassessmentClinicalBackgroundSections` — 7 background sections with provenance notes (green = reviewed at reassessment, purple = carried forward from initial)
- `reassessmentMedicalSection` — continued medical necessity re-evaluation
- `reassessmentStrengthsSection` — Part A: initial plan skill goals; Part B: gains this period (mastered skills/behaviors/CT)
- `reassessmentAreasSection` — active targets + new emerging items with [IN PLAN] / [MONITOR ONLY] / [EXCLUDED] labels
- `behaviorProgressSection`, `skillProgressSection`, `caregiverProgressSection` — data summary tables + actual trend chart + planned STO trajectory chart per item

### Track 6: Two-table layout for active plan items in new cycle section
`reassessmentPlanSection` rewritten for active behaviors, skills, and caregiver training goals:
- **Table 1 — Progress This Period**: Baseline | Avg | % Change | Sessions | Function | Current STO (e.g. "STO 2 of 4")
- **Table 2 — Remaining Treatment Milestones**: per-step rows sliced from `currentStoNumber` onwards; current step highlighted green (`F0FDF4`), LTO row highlighted blue (`EFF6FF`); falls back to 2-column STO/LTO table when no `stoSteps` defined
- `milestoneCell` / `milestoneTable` helpers added inside `reassessmentPlanSection`

### Track 7: Mastery date on mastered items
- **`makeReassessmentSession`** (`seedData.js`): `origMap` now records `masteryDate` (first `log.sessionDate` where `stoStatus === 'met'`) for behaviors; `skillEntriesWithDate` flat-map attaches `_sessionDate` so `masteryDate` can be found for skills; both surfaces added to return objects
- `caregiverTrainingSummary` gains `stoSteps[]` (filtered array), `ltoData` `{ percent, sessions }`, and `masteryDate: null`
- **Mastered behaviors table** now 7 columns including "Mastery Date" (`fmtDocDate(b.masteryDate)` or `"This auth period"`)
- **Mastered skills table** same — "Final Avg %" replaces "Current %" + mastery date column

### Track 8: `makeReassessmentSession` — initial plan definitions propagated
`seedData.js` — sections assembly for the reassessment session:
- `finalSections.behavior_targets` now carries `behaviorTargets: initialSession.sections.behavior_targets.behaviorTargets` → doc generator can resolve `stoSteps`, `operationalDefinition`, `hypothesizedFunction` by `behaviorId`
- `finalSections.skill_acquisitions` now carries `skillGoals: initialSession.sections.skill_acquisitions.skillGoals` → doc generator can resolve STO steps, mastery criteria, and domain; `reassessmentStrengthsSection` now has skill data to render
- `originalSkillSummary` gains `currentStoNumber` (from last log entry) and `masteryDate`

### Seed data
- `makeReassessmentSession`: `originalSkillSummary` rebuilt with stable date-sorted `skillEntriesWithDate`; `currentStoNumber` and `masteryDate` added to skill summary items

### Previous completed work (prior sessions on this branch)
**feat/reassessment-workflow-part-2** — Met Goals visual treatment + session logging modals + reassessment partition fixes

### Track 1: Met Goals visual treatment in session logging modals
Three modals (`BehaviorSessionModal.jsx`, `SkillSessionModal.jsx`, `CaregiverTrainingLogModal.jsx`) now partition plan targets into:
- **Active Goals** — `stoStatus !== 'met'` — rendered as before
- **Maintenance (Mastered Goals)** — `stoStatus === 'met'` — emerald-tinted section with "Met ✓" badge replacing STO radios, data entry optional, `↩ Return to active` button for regression/misclick recovery
- Save logic: maintenance goals don't block save; `allPlanMastered` / `allSkillsMastered` / `allGoalsMastered` edge case allows saving an all-mastered session with no data entered
- `stoStatus` is initialized from `latestLogEntryMap` so mastery state carries forward across sessions

### Track 2: Session timeline log panels — mastery badges
`BehaviorSessionLogPanel.jsx`, `SkillSessionLogPanel.jsx`, `CaregiverTrainingLogPanel.jsx`:
- `StoStatusChip` component: renders "Met ✓" emerald pill for mastered goals; plain colored text for in_progress/not_started
- Collapsed session header shows "N mastered ✓" badge when any goals in that session are Met

### Track 3: Reassessment "Mastered This Period" partition — correctness fixes
`AssessmentInterviewPage.jsx` — `OrigBehaviorRow` / `OrigSkillRow` / `CaregiverTrainingSummaryRow`:
- **Two-field pattern**: `sessionDerivedStoStatus` (behavior/caregiver) and `sessionDerivedStatus` (skill) — computed fresh from session logs in `makeReassessmentSession`, never overwritten by BCBA dropdown merge in `App.jsx`
- **App.jsx merge fix**: the behavior/skill merge now explicitly re-applies `sessionDerived*` from the fresh rebuild, so previously-saved stale BCBA values can't corrupt the partition
- **Skill status fix**: `originalSkillSummary.status` was hardcoded to `'in_progress'/'new'` — now reads `skillEntries[last]?.stoStatus` so mastered skills correctly surface
- **Caregiver**: added `sessionDerivedStoStatus` for consistency and future-proof merge safety
- Partition predicates in all three tables changed from `item.stoStatus` → `(item.sessionDerivedStoStatus ?? item.stoStatus)` and similarly for skills

### Track 4: Reassessment per-session detail table — color-coded STATUS column
`SessionDetailTable` component in `AssessmentInterviewPage.jsx`:
- Added `StoStatusCellChip` component: "Met ✓" emerald pill, "In progress" teal text, "Regressed" red text, muted slate for not started
- All three `sessionRows` / `ctSessionRows` builders now include `statusRaw: entry.stoStatus` alongside the formatted `status` label string
- `SessionDetailTable` detects `c.key === 'status'` + `row.statusRaw` and renders the chip instead of plain text

### Track 5: Reassessment STATUS column — replaced dropdown with read-only badge
`OrigBehaviorRow`, `OrigSkillRow`, `CaregiverTrainingSummaryRow`:
- Removed editable `<select>` dropdowns for STO status (were causing partition corruption when BCBA opened reassessment before latest sessions were logged)
- Replaced with `ReassessmentStatusBadge` component: "Mastered ✓" emerald pill, "In Progress" amber pill, "Not Started" slate pill
- Badge reads `sessionDerived*` field (immutable from logs), never the stale saved value
- Removed now-unused `STO_STATUS_OPTIONS`, `STO_STATUS_COLORS`, `SKILL_STATUS_OPTIONS`, `SKILL_STATUS_COLORS` constants and `statusColorClass` / `stoColorClass` variables

### Seed data
- Charlotte Davis session 6: Tantrum `stoStatus: 'met'` (clinically correct — hit ≤1×/day target)
- `makeReassessmentSession` `originalBehaviorSummary`: added `sessionDerivedStoStatus` field
- `makeReassessmentSession` `originalSkillSummary`: `status` now derived from last skill log entry's `stoStatus`; added `sessionDerivedStatus` field
- `makeReassessmentSession` caregiver summary: added `sessionDerivedStoStatus` field

### Previous completed work (prior sessions on this branch)
**feat/caregiver-training-update-STO-LTO-part-2:**
- Multi-step STO milestones for skill acquisition goals (`stoSteps[]` in `assessmentStore.js`, `SkillGoalCard.jsx`, all 6 downstream consumers, `renderSkillSTOChart`)
- Multi-step STO milestones for behavior targets (seed data for Emma, Marcus, Oliver, Charlotte)
- STO Milestone Rail in Plan Draft pipeline panel (`PlanDraftInlinePanel.jsx`)
- Dynamic caregiver training graph generation (`caregiverTrainingTargets[]`, `makeStandardCaregiverTargets()`, `renderCaregiverTrainingTargetChart()`)

---

## Working Rules

1. **Sessions are explicit.** Developer announces when a session begins and ends.
2. **End of session = push to GitHub.** All work committed and PR created manually. Never auto-push mid-session.
3. **No unsolicited changes.** Do not refactor, reorganize, or touch anything outside the explicitly scoped task.
4. **Clinical accuracy matters.** Treatment plans, STOs/LTOs, and assessment documents are legal and insurance-critical. Never fabricate, guess, or infer clinical data.
5. **Respect role boundaries.** Never allow RBT-level users to perform BCBA-level actions.
6. **Always work in `/Users/luis/Desktop/Product hub/AWCH CRM +AI`.** All file changes must be in this folder.

---

## Key Reference Documents (in project folder)

- `Re_ Crm system workflow /ABA_Authorization_Handbook.pdf` — payer-specific authorization requirements
- `Re_ Crm system workflow /Assessment Process.pdf` — full end-to-end clinical workflow
- `Re_ Crm system workflow /Referral Request Form (2).pdf` — referral form template
- `Re_ Crm system workflow /INITIAL ASSESSMENT_TEMPLATE.docx` — the clinical document this feature must produce
- `public/INITIAL_ASSESSMENT_TEMPLATE.docx` — assessment template used for DOCX export
