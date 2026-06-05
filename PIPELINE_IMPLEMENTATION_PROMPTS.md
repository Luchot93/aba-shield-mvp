# Pipeline Stage Improvement — Claude Code Implementation Prompts

Use each prompt in a fresh Claude Code conversation to implement one stage at a time.
Each prompt is fully self-contained — no prior context needed.

---

## HOW TO USE

1. Open Claude Code in the project root (`/Users/luis/Desktop/Product hub/AWCH CRM +AI`)
2. Copy one prompt block below
3. Paste into Claude Code
4. Review changes, run `npm run build` to verify
5. Commit, then move to the next prompt

---

---

## PROMPT 1 — Shared Foundation: `file_upload` date type + real uploads

**Scope:** `src/constants/checklist.js` + `src/features/detail/ClientDetailPage.jsx`

```
I'm working on an ABA CRM built with React 18 + Vite + Tailwind. The pipeline has 9 stages, each with a checklist rendered in `src/features/detail/ClientDetailPage.jsx` via a `CheckRow` component.

There are two foundations to fix before improving individual stages:

### Fix 1 — `form_field` date type
The `CheckRow` case for `form_field` currently handles `fieldType:'text'` and `fieldType:'number'` but not `fieldType:'date'`. Add `fieldType:'date'` support: render `<input type="date">` with the same Tailwind styling as the other inputs (border-stone-200, focus:border-teal-400, focus:ring-2, focus:ring-teal-100, px-3 py-2 text-sm rounded-lg). The value/onChange pattern should match how 'text' fields work — call `patchCL(item.clSec, item.key, e.target.value)`.

### Fix 2 — Mock upload → real file_upload awareness
Several stages currently use `type:'upload'` (mock, no file picker). We'll convert these per stage in later prompts. For now, confirm the existing `file_upload` case in CheckRow works: it should use a hidden `<input type="file">`, read the file with FileReader as a dataUrl, call `patchCL`, `pushDoc`, and `pushLog`. Read the existing `file_upload` case and verify it handles the `item.accept` and `item.docType` properties. If anything is missing, fix it.

No visual regressions. Run `npm run build` to verify.
```

---

## PROMPT 2 — Stage 1: Intake

**Scope:** `src/constants/checklist.js` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). I need to improve the Intake pipeline stage.

### Files to modify
- `src/constants/checklist.js` — `mkChecklist()` and `getStageItems('intake')`
- `src/constants/seedData.js` — add new fields to seed clients

### Changes to `mkChecklist()` — add these keys to the `intake` section:
```js
consent_signed: false,
referral_source: '',        // who referred this client
insurance_plan: '',         // e.g. "Aetna Better Health of Florida"
member_id_verified: '',     // member ID confirmed at intake
copay_deductible: '',       // e.g. "$0 copay, $0 deductible remaining"
```

### Changes to `getStageItems('intake')`:

1. Change all 4 `type:'upload'` items to `type:'file_upload'` and add `accept:'.pdf,.docx,.jpg,.png'` + appropriate `docType` values:
   - referral_form → docType: 'referral_form'
   - insurance_card → docType: 'insurance_card'
   - cde → docType: 'cde'
   - aba_prescription → docType: 'aba_prescription'

2. Add after aba_prescription (before the demographics auto item):
```js
{ type:'file_upload', key:'consent_signed', label:'Intake consent packet signed', clSec:'intake', accept:'.pdf,.docx', docType:'consent' },
```

3. Add after the demographics auto item (before insurance_verified):
```js
{ type:'form_field', key:'referral_source',    label:'Referral source',           clSec:'intake', fieldType:'text',   placeholder:'e.g. Dr. Smith, school district, parent referral' },
{ type:'form_field', key:'insurance_plan',     label:'Insurance plan name',       clSec:'intake', fieldType:'text',   placeholder:'e.g. Aetna Better Health FL' },
{ type:'form_field', key:'member_id_verified', label:'Member ID / Group #',       clSec:'intake', fieldType:'text',   placeholder:'MBR-0000000' },
{ type:'form_field', key:'copay_deductible',   label:'Copay / deductible details',clSec:'intake', fieldType:'text',   placeholder:'$0 copay, $500 deductible remaining' },
```

4. Keep insurance_verified and benefits_verified checkboxes as-is.

### `seedData.js` — add realistic values to each seed client's checklist.intake:
```js
referral_source: 'Primary care physician',
insurance_plan: 'Aetna Better Health of Florida',
member_id_verified: 'MBR-0123456',
copay_deductible: '$0 copay, $0 deductible remaining',
```

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 3 — Stage 2: Auth Assessment

**Scope:** `src/constants/checklist.js` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). I need to improve the Auth Assessment pipeline stage.

### Files to modify
- `src/constants/checklist.js` — `mkChecklist()` and `getStageItems('auth_assessment')`
- `src/constants/seedData.js` — add new fields to seed clients

### Changes to `mkChecklist()` — add these keys to the `auth_assessment` section:
```js
submission_date: '',          // when the auth request was submitted to insurer
units_requested: '',          // how many CPT 97151 units requested
expected_response_date: '',   // insurer's expected turnaround date
auth_portal: '',              // submission method e.g. "Availity portal", "fax"
```

### Changes to `getStageItems('auth_assessment')`:

1. Change `prior_assessments` from `type:'upload'` → `type:'file_upload'`:
```js
{ type:'file_upload', key:'prior_assessments', label:'Prior assessments attached', clSec:'auth_assessment', accept:'.pdf,.docx', docType:'prior_assessments' },
```

2. Add these four form_field items after the `auth_submitted` checkbox:
```js
{ type:'form_field', key:'submission_date',        label:'Submission date',              clSec:'auth_assessment', fieldType:'date' },
{ type:'form_field', key:'units_requested',        label:'CPT 97151 units requested',    clSec:'auth_assessment', fieldType:'number', placeholder:'e.g. 16' },
{ type:'form_field', key:'expected_response_date', label:'Expected response date',       clSec:'auth_assessment', fieldType:'date' },
{ type:'form_field', key:'auth_portal',            label:'Submission method / portal',   clSec:'auth_assessment', fieldType:'text',   placeholder:'e.g. Availity, fax, phone' },
```

3. Keep reference_number, cpt_97151_received, and bcba_assigned items as-is.

### `seedData.js` — add realistic values to seed clients at auth_assessment stage:
```js
submission_date: '2026-01-10',
units_requested: '16',
expected_response_date: '2026-01-24',
auth_portal: 'Availity portal',
```

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 4 — Stage 3: Assessment (minor additions only)

**Scope:** `src/constants/checklist.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Assessment stage is already well-developed (Smart Assessment bridge, dated Vineland/BASC items, real file_upload for final report). I only need two minor additions.

### File to modify
- `src/constants/checklist.js` — `mkChecklist()` and `getStageItems('assessment')`

### Changes to `mkChecklist()` — add two keys to the `assessment` section:
```js
observation_date: '',               // date of direct observation session
additional_assessments_detail: '',  // which additional tools were used (free text)
```

### Changes to `getStageItems('assessment')`:

1. After the `direct_observation` checkbox item, insert:
```js
{ type:'form_field', key:'observation_date', label:'Observation session date', clSec:'assessment', fieldType:'date' },
```

2. After the `additional_assessments` checkbox item, insert:
```js
{ type:'form_field', key:'additional_assessments_detail', label:'Additional tools used', clSec:'assessment', fieldType:'text', placeholder:'e.g. ABLLS-R, AFLS, VB-MAPP' },
```

IMPORTANT: Do NOT touch any of the Smart Assessment items, the `bridge` item, or `file_upload` final_assessment_report item. Only add these two form_field items.

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 5 — Stage 4: Plan Draft (insurance fields only — do NOT touch assessment data)

**Scope:** `src/constants/checklist.js` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Plan Draft stage has five `smart_auto` items that are auto-populated from the Smart Assessment feature — DO NOT touch those. I only need to improve the insurance submission fields below the smart_auto section.

### Files to modify
- `src/constants/checklist.js` — `mkChecklist()` and `getStageItems('plan_draft')`
- `src/constants/seedData.js`

### Context
The five `smart_auto` items (medical_necessity, skill_targets, behavior_goals, intervention_strategies, baseline_graphs) pull data from `client.assessment_session` automatically. Leave them completely untouched. The new fields I'm adding are the BCBA's insurance submission decisions — CPT code hour requests, plan period dates, and session structure — which are separate from the assessment content.

### Changes to `mkChecklist()` — in the `plan_draft` section:

Remove the key `supervision_hours` (it will be replaced by three CPT-specific fields). Add:
```js
hours_97153: '',              // direct therapy hours/month requested
hours_97155: '',              // BCBA supervision hours/month requested
hours_97156: '',              // caregiver training hours/month requested
plan_start_date: '',          // treatment plan period start date
plan_end_date: '',            // treatment plan period end date (typically +6 months)
sessions_per_week: '',        // e.g. "10"
session_duration_min: '',     // e.g. "120"
```

Keep all other existing keys: medical_necessity, skill_targets, behavior_goals, intervention_strategies, baseline_graphs, data_methodology, ai_draft_approved, treatment_plan_finalized.

### Changes to `getStageItems('plan_draft')`:

1. Replace the single `supervision_hours` form_field item with these three:
```js
{ type:'form_field', key:'hours_97153',         label:'CPT 97153 — Direct therapy hrs/mo',     clSec:'plan_draft', fieldType:'number', placeholder:'e.g. 80' },
{ type:'form_field', key:'hours_97155',         label:'CPT 97155 — BCBA supervision hrs/mo',   clSec:'plan_draft', fieldType:'number', placeholder:'e.g. 12' },
{ type:'form_field', key:'hours_97156',         label:'CPT 97156 — Caregiver training hrs/mo', clSec:'plan_draft', fieldType:'number', placeholder:'e.g. 8' },
```

2. After the `data_methodology` form_field, add:
```js
{ type:'form_field', key:'plan_start_date',      label:'Plan period start date',               clSec:'plan_draft', fieldType:'date' },
{ type:'form_field', key:'plan_end_date',        label:'Plan period end date',                 clSec:'plan_draft', fieldType:'date' },
{ type:'form_field', key:'sessions_per_week',    label:'Sessions per week',                    clSec:'plan_draft', fieldType:'number', placeholder:'e.g. 10' },
{ type:'form_field', key:'session_duration_min', label:'Session duration (minutes)',            clSec:'plan_draft', fieldType:'number', placeholder:'e.g. 120' },
```

3. Change `treatment_plan_finalized` from `type:'checkbox'` to `type:'file_upload'`:
```js
{ type:'file_upload', key:'treatment_plan_finalized', label:'Signed treatment plan uploaded', clSec:'plan_draft', accept:'.pdf,.docx', docType:'treatment_plan' },
```

4. Leave ALL `smart_auto` items exactly as they are.

### `seedData.js` — add realistic values for demo clients in plan_draft stage:
```js
hours_97153: '80',
hours_97155: '12',
hours_97156: '8',
plan_start_date: '2026-02-01',
plan_end_date: '2026-07-31',
sessions_per_week: '10',
session_duration_min: '120',
```

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 6 — Stage 5: Submitted (most important — populates Authorized + Services)

**Scope:** `src/constants/checklist.js` + `src/features/detail/ClientDetailPage.jsx` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Submitted stage is the weakest — it has a mock upload and captures almost no data. The authorization details entered here need to flow into the Authorized and Services stages, so this is the most impactful change.

### Files to modify
- `src/constants/checklist.js`
- `src/features/detail/ClientDetailPage.jsx`
- `src/constants/seedData.js`

### Changes to `mkChecklist()` — expand the `submitted` section:
Replace the existing structure:
```js
submitted: {
  plan_submitted:false, cpt_units_requested:false, approval_uploaded:false, authorized_hours:'',
}
```
With:
```js
submitted: {
  plan_submitted: false,
  cpt_units_requested: false,
  plan_submission_date: '',     // when the treatment plan was submitted to insurer
  auth_reference_number: '',    // insurer-assigned authorization reference number
  authorized_97153: '',         // approved direct therapy hours/month
  authorized_97155: '',         // approved BCBA supervision hours/month
  authorized_97156: '',         // approved caregiver training hours/month
  auth_start_date: '',          // authorization period start date
  auth_end_date: '',            // authorization period end date
  approval_uploaded: false,     // authorization approval document received
}
```

### Changes to `getStageItems('submitted')`:
Replace current items with:
```js
{ type:'checkbox',   key:'plan_submitted',         label:'Treatment plan submitted to insurer',     clSec:'submitted' },
{ type:'checkbox',   key:'cpt_units_requested',    label:'CPT units requested (97153/97155/97156)', clSec:'submitted' },
{ type:'form_field', key:'plan_submission_date',   label:'Plan submission date',                    clSec:'submitted', fieldType:'date' },
{ type:'file_upload',key:'approval_uploaded',      label:'Authorization approval document',         clSec:'submitted', accept:'.pdf,.docx,.jpg', docType:'auth_approval' },
{ type:'form_field', key:'auth_reference_number',  label:'Authorization reference number',          clSec:'submitted', fieldType:'text',   placeholder:'AUTH-0000000' },
{ type:'form_field', key:'authorized_97153',       label:'Authorized 97153 — Direct hrs/mo',        clSec:'submitted', fieldType:'number', placeholder:'hrs/month' },
{ type:'form_field', key:'authorized_97155',       label:'Authorized 97155 — BCBA hrs/mo',          clSec:'submitted', fieldType:'number', placeholder:'hrs/month' },
{ type:'form_field', key:'authorized_97156',       label:'Authorized 97156 — Caregiver hrs/mo',     clSec:'submitted', fieldType:'number', placeholder:'hrs/month' },
{ type:'form_field', key:'auth_start_date',        label:'Authorization period start',              clSec:'submitted', fieldType:'date' },
{ type:'form_field', key:'auth_end_date',          label:'Authorization period end',                clSec:'submitted', fieldType:'date' },
```

### Changes to `ClientDetailPage.jsx` — Auth Summary banner in Authorized stage:
In the section that renders the Authorized stage checklist, add a read-only summary banner ABOVE the checklist items when `client.checklist?.submitted?.auth_reference_number` exists:

```jsx
{client.stage === 'authorized' && client.checklist?.submitted?.auth_reference_number && (
  <div className="mb-4 p-3 rounded-xl border border-teal-200 bg-teal-50/60">
    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-2">Authorization Summary</p>
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Auth #</span>
        <span className="font-semibold text-slate-800 font-mono">{client.checklist.submitted.auth_reference_number}</span>
      </div>
      {client.checklist.submitted.auth_start_date && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Period</span>
          <span className="font-semibold text-slate-800">
            {new Date(client.checklist.submitted.auth_start_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
            {' → '}
            {new Date(client.checklist.submitted.auth_end_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
          </span>
        </div>
      )}
      {client.checklist.submitted.authorized_97153 && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Hours</span>
          <span className="font-semibold text-slate-800">
            97153: {client.checklist.submitted.authorized_97153}h &middot; 97155: {client.checklist.submitted.authorized_97155 || '—'}h &middot; 97156: {client.checklist.submitted.authorized_97156 || '—'}h
          </span>
        </div>
      )}
    </div>
  </div>
)}
```

### `seedData.js` — add realistic values for demo clients in submitted/authorized stages:
```js
plan_submission_date: '2026-02-01',
auth_reference_number: 'AUTH-2026-04421',
authorized_97153: '80',
authorized_97155: '12',
authorized_97156: '8',
auth_start_date: '2026-02-15',
auth_end_date: '2026-08-14',
```

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 7 — Stage 6: Denied

**Scope:** `src/constants/checklist.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). I need to improve the Denied pipeline stage with structured denial tracking.

### File to modify
- `src/constants/checklist.js`

### Changes to `mkChecklist()` — add to the `denied` section:
```js
denial_date: '',              // when the denial was received
denial_code: '',              // insurer's denial code (e.g. AUTH-051, CO-97)
appeal_deadline: '',          // typically denial_date + 30–60 days
appeal_outcome: '',           // Approved / Upheld (Denied) / Pending
```

### Changes to `getStageItems('denied')`:

1. Add at the very beginning (before denial_reason):
```js
{ type:'form_field', key:'denial_date',     label:'Denial received date',  clSec:'denied', fieldType:'date' },
{ type:'form_field', key:'denial_code',     label:'Denial code',           clSec:'denied', fieldType:'text', placeholder:'e.g. AUTH-051, CO-97, CO-4' },
{ type:'form_field', key:'appeal_deadline', label:'Appeal deadline',       clSec:'denied', fieldType:'date' },
```

2. Change `supporting_docs` from `type:'upload'` → `type:'file_upload'`:
```js
{ type:'file_upload', key:'supporting_docs', label:'Supporting documentation prepared', clSec:'denied', accept:'.pdf,.docx', docType:'appeal_docs' },
```

3. Add after peer_to_peer_completed:
```js
{ type:'form_field', key:'appeal_outcome', label:'Appeal outcome', clSec:'denied', fieldType:'text', placeholder:'Approved / Upheld / Pending' },
```

Keep denial_reason, peer_to_peer_scheduled (with its note), and peer_to_peer_completed as-is.

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 8 — Stage 7: Authorized

**Scope:** `src/constants/checklist.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Authorized stage needs one addition: a session schedule field, so staff can record the agreed weekly pattern before moving to Staffing.

### File to modify
- `src/constants/checklist.js`

### Changes to `mkChecklist()` — add to the `authorized` section:
```js
schedule_template: '',   // e.g. "Mon/Wed/Fri 9am–1pm, Tue/Thu 10am–12pm"
```

### Changes to `getStageItems('authorized')`:

Add after the `rbt_credentials_attached` auto item:
```js
{ type:'form_field', key:'schedule_template', label:'Weekly session schedule', clSec:'authorized', fieldType:'text', placeholder:'e.g. Mon/Wed/Fri 9–1pm, Tue/Thu 10–12pm' },
```

Keep all existing items (bcba_matches_auth, bcba_credentials_verified, rbt_assigned, rbt_cert_valid, rbt_credentials_attached) exactly as-is.

Note: The auth summary banner that reads from submitted stage data was added in Prompt 6 — no changes to ClientDetailPage.jsx needed here.

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 9 — Stage 8: Staffing

**Scope:** `src/constants/checklist.js` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Staffing stage is currently four plain checkboxes with no data capture. I need to add first session scheduling details.

### Files to modify
- `src/constants/checklist.js`
- `src/constants/seedData.js`

### Changes to `mkChecklist()` — add to the `staffing` section:
```js
first_session_date: '',      // actual date of first session
first_session_time: '',      // e.g. "9:00 AM"
session_location: '',        // "Client's home", "Clinic", "School"
```

### Changes to `getStageItems('staffing')`:

After the `first_session_scheduled` checkbox, insert:
```js
{ type:'form_field', key:'first_session_date', label:'First session date',  clSec:'staffing', fieldType:'date' },
{ type:'form_field', key:'first_session_time', label:'First session time',  clSec:'staffing', fieldType:'text', placeholder:'e.g. 9:00 AM' },
{ type:'form_field', key:'session_location',   label:'Session location',    clSec:'staffing', fieldType:'text', placeholder:"Client's home / Clinic / School" },
```

Keep all four existing checkboxes (caregiver_availability, schedule_coordinated, first_session_scheduled, first_session_completed) as-is.

### `seedData.js` — add values for demo clients in staffing stage:
```js
first_session_date: '2026-02-20',
first_session_time: '9:00 AM',
session_location: "Client's home",
```

Run `npm run build` to verify 0 errors.
```

---

## PROMPT 10 — Stage 9: Services / Reauth

**Scope:** `src/constants/checklist.js` + `src/features/detail/ClientDetailPage.jsx` + `src/constants/seedData.js`

```
I'm working on an ABA CRM (React 18 + Vite + Tailwind). The Services/Reauth stage is five plain checkboxes. I need to add real file uploads for the reports and a reauth countdown banner.

### Files to modify
- `src/constants/checklist.js` (REAUTH_ITEMS + mkChecklist services_reauth section)
- `src/features/detail/ClientDetailPage.jsx` (reauth countdown banner)
- `src/constants/seedData.js`

### Changes to `mkChecklist()` — add to the `services_reauth` section:
```js
reauth_submission_date: '',   // when reauth was submitted
hours_consumed_97153: '',     // direct hours used this auth period
hours_consumed_97155: '',     // BCBA hours used
hours_consumed_97156: '',     // caregiver hours used
```

### Changes to `REAUTH_ITEMS` in checklist.js:

Replace the `progress_report` checkbox item with a file_upload:
```js
{ type:'file_upload', key:'progress_report',  label:'Progress report',           clSec:'services_reauth', accept:'.pdf,.docx', docType:'progress_report' },
```

Replace the `updated_graphs` checkbox item with a file_upload:
```js
{ type:'file_upload', key:'updated_graphs',   label:'Updated behavioral graphs', clSec:'services_reauth', accept:'.pdf,.png,.jpg', docType:'updated_graphs' },
```

Add after the `reauth_submitted` checkbox:
```js
{ type:'form_field', key:'reauth_submission_date', label:'Reauth submission date',             clSec:'services_reauth', fieldType:'date' },
{ type:'form_field', key:'hours_consumed_97153',   label:'97153 hours used this period',       clSec:'services_reauth', fieldType:'number', placeholder:'e.g. 240' },
{ type:'form_field', key:'hours_consumed_97155',   label:'97155 hours used this period',       clSec:'services_reauth', fieldType:'number', placeholder:'e.g. 36' },
{ type:'form_field', key:'hours_consumed_97156',   label:'97156 hours used this period',       clSec:'services_reauth', fieldType:'number', placeholder:'e.g. 24' },
```

Keep vineland3_updated, basc3_updated, and reauth_submitted checkboxes as-is.

### Changes to `ClientDetailPage.jsx` — reauth countdown banner:

In the section that renders the Services stage checklist, add a countdown banner ABOVE the reauth checklist items when `client.checklist?.submitted?.auth_end_date` exists.

Compute days remaining:
```js
const authEnd = client.checklist?.submitted?.auth_end_date;
const daysRemaining = authEnd
  ? Math.ceil((new Date(authEnd) - new Date()) / (1000 * 60 * 60 * 24))
  : null;
```

Render:
```jsx
{client.stage === 'services' && daysRemaining !== null && (
  <div className={`mb-4 p-3 rounded-xl border flex items-center gap-3 ${
    daysRemaining < 30  ? 'bg-red-50 border-red-200' :
    daysRemaining < 60  ? 'bg-amber-50 border-amber-200' :
    'bg-slate-50 border-slate-200'
  }`}>
    <div className={`text-2xl font-bold tabular-nums ${
      daysRemaining < 30 ? 'text-red-600' : daysRemaining < 60 ? 'text-amber-600' : 'text-slate-600'
    }`}>{daysRemaining}</div>
    <div>
      <p className={`text-xs font-semibold ${daysRemaining < 30 ? 'text-red-700' : daysRemaining < 60 ? 'text-amber-700' : 'text-slate-700'}`}>
        days until authorization expires
      </p>
      <p className="text-[10px] text-slate-500">
        {new Date(authEnd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
        {daysRemaining < 60 ? ' — start reauth now' : ''}
      </p>
    </div>
  </div>
)}
```

### `seedData.js` — add values for demo clients in services stage:
```js
hours_consumed_97153: '240',
hours_consumed_97155: '36',
hours_consumed_97156: '24',
```

Run `npm run build` to verify 0 errors.
```

---

## NOTES

- **Implement in order**: Prompts 1→2→...→10. Each builds on the previous.
- **One stage at a time**: Run `npm run build` between each prompt before proceeding.
- **Seed data**: Always update `seedData.js` so demo clients look realistic after each change.
- **Do not touch assessment_session**: The Smart Assessment data pipeline (`client.assessment_session`, all `smart_auto` items) is separate and must not be modified in any of these prompts.
- **Auth summary (Prompt 6)** and **reauth countdown (Prompt 10)** are the two most impactful visual additions — they surface upstream data without requiring the user to navigate between stages.
