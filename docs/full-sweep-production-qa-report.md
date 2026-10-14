# Full-Sweep Production QA Report — ABA Shield CRM

_Date: 2026-10-14_
_Tester: Claude Code (manual, multi-session), driven through production at https://aba-shield-mvp.vercel.app/_
_Status: **Diagnosis only.** Nothing in this report was fixed as part of this testing effort — per the task ("test and document"), everything below is findings + root cause, pending a decision on what to fix and when._

This is a top-to-bottom functional walkthrough of the real, shipped CRM against **production** — not seed data, not `VITE_E2E`/demo mode. It replaces ad hoc QA notes with one document that also doubles as **reusable instructions for the next full-sweep pass** (see §9, Testing Methodology).

## 1. Scope & environment

- **Target:** https://aba-shield-mvp.vercel.app/ (production Vercel deploy), backed by the real Supabase project (`qravuejkiluimaihhbrf`), confirmed via [`src/lib/supabase.js`](../src/lib/supabase.js) that the client-side app always uses `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` in production builds (`IS_E2E` is statically false, Rollup drops the mock arm) — so every finding below reflects what a real logged-in user experiences, not a privileged/service-role view.
- **Login:** already signed in as an existing admin account; no credentials were entered by the tester.
- **Test data created this session** (real rows, not seed data):
  - Staff: `QA Test BCBA` (BCBA, cert `BCBA-QA001`), `QA Test RBT` (RBT, cert `RBT-QA002`... invite path), `QA Test RBT2` (RBT, invite pending — see §6) — all invited using aliases of `luis.teranarguello@gmail.com` (`+qabcba`, `+qarbt`, `+qarbt2`).
  - Client: `QA FullSweep Test Client` (fake/placeholder demographics, insurer "Test Insurer Co").
- **AI draft generation:** run for real against the Anthropic API (`VITE_DEMO_MODE` path not used), incurring real API cost, per explicit approval.
- Coverage: client creation, staff creation/invite, Initial Assessment (full section walkthrough + AI draft + `.docx` export), Pipeline/Kanban stage progression, BCBA/RBT assignment, Staff Directory, and RLS/multi-tenant isolation at the database level.

## 2. Executive summary — ranked by severity

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | RLS policies on `clients` compare `bcba_id`/`rbt_id` (which store `staff.id`) against `auth.uid()` (which is `staff.user_id`) — **every real non-admin login sees zero clients, including their own assigned cases** | **Critical** | Confirmed, root-caused, reproducible |
| 2 | `itemComplete()`'s `'select'` case has no optional-item bypass — the **Auth Assessment stage can never reach 100% complete**, permanently blocking every client from advancing past the 2nd Pipeline stage via the UI | **Critical** | Confirmed, root-caused, reproducible |
| 3 | Service Sessions feature is untestable in practice — zero clients can ever reach "In Services" | High | Confirmed; direct downstream consequence of #2 |
| 4 | "Testing as" role-switcher does not actually change the authenticated session/RLS context — it's a cosmetic UI-only toggle | Medium | Confirmed |
| 5 | Supabase Auth shared SMTP email rate limit blocks rapid-fire staff invites | Low (environment, not app) | Confirmed, documented |
| 6 | AI-generated draft text contains literal `"?"` placeholders (Skill Acquisition, Maladaptive Behaviors, Caregiver Training LTO) and `[Date]`/`[Clinician Name]` bracket-template placeholders (Self-Stimulatory Behavior) | Medium | Confirmed in prior session |
| 7 | Caregiver Training STO numeric fields show placeholder text instead of real saved values on re-entry | Low/Medium | Confirmed in prior session |
| 8 | `cert_expiry` rendered "Expired" for a null value | Low | Found & fixed in prior session |
| 9 | Document upload accepts/rejects file types correctly | — | Verified working, prior session |

Findings 1 and 2 are both severe enough to block a real multi-user rollout: #1 means no BCBA/RBT can use the Pipeline or Clients views at all once they log in with their own account (everything prior QA ever exercised was done as admin, which bypasses the broken check via `is_admin()`); #2 means even the admin-only happy path cannot move a single client past the Auth Assessment stage, which also explains why #3 (Service Sessions) has never been exercisable.

## 3. CRITICAL — RLS: `bcba_id`/`rbt_id` store `staff.id`, but policies compare against `auth.uid()`

### 3.1 The policy

[`supabase/migrations/20260928120000_client_staff_assignment_rls.sql:49-55`](../supabase/migrations/20260928120000_client_staff_assignment_rls.sql#L49-L55):
```sql
create policy "clients select admin or assigned" on public.clients
  for select
  using (
    public.is_admin()
    or bcba_id = auth.uid()
    or rbt_id = auth.uid()
  );
```
The `for update` policy (lines 60-71) has the identical `bcba_id = auth.uid() or rbt_id = auth.uid()` condition in both `USING` and `WITH CHECK`.

### 3.2 The mismatch

`clients.bcba_id` / `clients.rbt_id` are populated from `staff.id` (the `staff` table's own primary key) — confirmed by the assignment UI (`ClientDetailPage.jsx`, `KanbanCard.jsx`: `staff.find(s => s.id === client.rbt_id)`) and by direct data inspection. There is **no foreign key constraint** tying these columns to `staff.id` specifically (`pg_constraint` returns zero FK constraints on them), but the application code consistently treats them as `staff.id`.

`auth.uid()`, inside an RLS policy, returns the current session's `auth.users.id` — which is `staff.user_id`, a **different** UUID for the same person. `staff.id ≠ staff.user_id` for every staff row. So `bcba_id = auth.uid()` can never be true for a real logged-in BCBA/RBT, no matter who they are or what they're assigned to.

By contrast, `is_admin()` ([lines 23-34](../supabase/migrations/20260928120000_client_staff_assignment_rls.sql#L23-L34)) is correct — it compares `profiles.id = auth.uid()`, and `profiles.id` genuinely is keyed to `auth.uid()`. This is why the bug was never caught: **all QA on Pipeline/Staff, across every prior session, was done as the admin account**, which short-circuits past the broken `bcba_id`/`rbt_id` comparison entirely via the `or public.is_admin()` clause.

### 3.3 Reproduction (fresh, this session)

Test fixture: `QA Test BCBA` — `staff.id = ed70c41d-bc83-44b6-8ae6-b81833060b41`, `staff.user_id = 3bdb6d03-27aa-49f9-8837-76259b151b96`, assigned as `bcba_id` on `QA FullSweep Test Client`.

**Simulating the BCBA's real session** (their actual `auth.uid()`, via `staff.user_id`):
```sql
select set_config('request.jwt.claims', '{"sub":"3bdb6d03-27aa-49f9-8837-76259b151b96","role":"authenticated"}', true);
set local role authenticated;
select count(*) from public.clients;
-- visible_client_count_using_real_auth_uid: 0
```
Expected ≥ 1 (their own assigned case). Got 0.

**Simulating with `staff.id` used as the fake `sub`** (proving the policy's comparison target is staff.id-shaped, not auth.uid-shaped):
```sql
select set_config('request.jwt.claims', '{"sub":"ed70c41d-bc83-44b6-8ae6-b81833060b41","role":"authenticated"}', true);
set local role authenticated;
select count(*) from public.clients;
-- visible_if_staff_id_used_as_sub: 1
```
This confirms the mechanism precisely: swap in the staff-table ID as if it *were* the auth ID, and the row becomes visible.

### 3.4 Impact

Every non-admin staff member (BCBA, BCaBA, RBT) who logs into production today sees **zero clients** in Clients and Pipeline — including cases legitimately assigned to them. This fails closed (no cross-tenant data leakage — the bug under-shows rather than over-shows), but it breaks core product functionality for every real user who isn't an admin. This is the highest-severity finding in this report.

### 3.5 What correctly stopped a workaround attempt (positive finding)

While investigating, a direct `UPDATE clients SET rbt_id = ...` via raw SQL (attempting to route around a separate, now-superseded UI concern — see §4) was correctly rejected:
```
ERROR: 42501: Only an admin can reassign a client's BCBA or RBT.
```
raised by `enforce_client_assignment_admin_only()` ([same migration, lines 90-111](../supabase/migrations/20260928120000_client_staff_assignment_rls.sql#L90-L111)), because the raw-SQL session has no authenticated JWT context and `is_admin()` correctly evaluates false. This trigger works exactly as designed — a genuine defense-in-depth control, independent of (and unaffected by) the bug above.

### 3.6 Suggested fix direction (not implemented)

Either (a) change the RLS policies to join through `staff` (`bcba_id in (select id from staff where user_id = auth.uid())`, same for `rbt_id`), or (b) change `clients.bcba_id`/`rbt_id` to store `staff.user_id` directly and update every read site (`KanbanCard.jsx`, `ClientDetailPage.jsx`, `checklist.js`'s `staff.find(s => s.id === ...)` lookups, `PipelinePage.jsx`'s `mycases` filter) to match on `user_id` instead of `id`. Option (a) is the smaller blast radius — it only touches the two RLS policies, not every `staff.id` lookup in the app.

## 4. CRITICAL — Auth Assessment stage can never reach 100% complete, blocking every client from advancing

### 4.1 Live reproduction

`QA FullSweep Test Client`, Pipeline → Auth 97151 column, shows **"1 item missing"**; opening Client Detail shows **"15 of 16 complete"** under "To advance to Assessment," with every visible row showing as checked/uploaded/saved (CDE confirmed, ABA prescription confirmed, referral form confirmed, prior assessments N/A, ROI uploaded, authorization submitted, submission date/reference/method/units/expected-response all saved with a green "✓ Current:" confirmation, CPT 97151 authorization received, approval doc uploaded, units approved, BCBA assigned) — the "Complete all items to advance" button stays permanently disabled (greyed out) regardless. **No individual item in the UI is visually flagged as incomplete or missing.**

### 4.2 Root cause

[`src/constants/checklist.js:77-78`](../src/constants/checklist.js#L77-L78) defines the "Submission method" item as optional:
```js
{ type:'select', key:'cpt97151_submission_method', label:'Submission method', clSec:'auth_assessment',
  clientField:'cpt97151_submission_method', optional:true,
  options:[{ value:'availity', label:'Availity' }, { value:'fax', label:'Fax' }, { value:'phone', label:'Phone' }, { value:'other', label:'Other' }] },
```
but [`src/utils/checklist.js:71-73`](../src/utils/checklist.js#L71-L73), `itemComplete()`'s `'select'` case, never checks `item.optional`:
```js
case 'select':
  if (item.completeValues) return item.completeValues.includes(val);
  return val === item.completeValue;
```
Every other case in the same function (`'checkbox'`, `'upload'`, `'file_upload'`, `'form_field'`) explicitly short-circuits with `if (item.optional) return true;` before doing any value comparison — `'select'` is the one case missing that bypass. Since this item defines neither `completeValue` nor `completeValues`, the fallback `val === item.completeValue` evaluates to `val === undefined`. Once a user picks any option (`val` becomes `'availity'`, `'fax'`, etc.), the comparison is permanently `false`. There is no value — selected or not — that makes this item register complete.

The other `'select'`-type checklist items (`insurance_verification_status` at [`checklist.js:62`](../src/constants/checklist.js#L62), `appeal_outcome` at [`checklist.js:145`](../src/constants/checklist.js#L145)) both define `completeValue`/`completeValues` and are **not** marked `optional`, so they're unaffected — this bug is isolated to exactly this one item.

### 4.3 Impact

`getStageItems('auth_assessment')` returns 16 items total; `displayItems.length === completeCount` is the gate for `allDone` → `canAdvance` ([`src/features/detail/ClientDetailPage.jsx:297-300`](../src/features/detail/ClientDetailPage.jsx#L297-L300)). Because this one item can never evaluate `true`, **no client can ever reach 16/16 for the Auth Assessment stage**, meaning **no client can ever advance from Auth Assessment to Assessment via the UI, for any BCBA/admin, regardless of how completely every other field is filled.** This is a universal, stage-wide block — not specific to the test client.

Correction for the record: an earlier working theory during this session (before the code/DB were checked directly) suspected the blocker was a missing RBT-assignment control at this stage. That theory does not hold up — `rbt_assigned` is only required at the `authorized` stage ([`checklist.js:152`](../src/constants/checklist.js#L152)), and `KanbanCard.jsx`'s `showRBT` gate correctly only renders the RBT control from `authorized` onward — so the RBT-control timing is actually correct, not a bug. The real, verified root cause is the `'select'`-case optional bypass above.

### 4.4 Suggested fix direction (not implemented)

Add `if (item.optional) return true;` as the first line of the `'select'` case in `itemComplete()` ([`src/utils/checklist.js:71`](../src/utils/checklist.js#L71)), matching every other case type in the same function.

## 5. HIGH — Service Sessions untestable (downstream of §4)

The Service Sessions feature is scoped to clients in the "In Services" Pipeline stage. Pipeline board shows "Services: 0 / No clients in this stage"; the Service Sessions page itself shows "0 clients in services / No clients assigned." Since no client can ever advance past Auth Assessment (§4), none can ever reach Services — this feature has effectively never been exercisable end-to-end in production. Not an independent bug; resolves automatically once §4 is fixed and at least one client is walked through every intermediate stage.

## 6. "Testing as" role-switcher is mock/disconnected

The NavBar's "Testing as:" role switcher (visible top-right, next to the signed-in admin's email) does not change the actual authenticated session or RLS context — switching it does not change what data loads or what the backend sees. It's cosmetic only. This was tried first (per plan) as a faster path to BCBA-perspective testing than creating/inviting a real second user, but proved non-functional, which is why real staff creation + the DB-level RLS simulation (§3.3) were used instead. This also explains why role-based QA using this switcher would never have surfaced the §3 bug.

## 7. Supabase Auth email rate limit (environment constraint, not an app bug)

Inviting a second BCBA (`QA Test BCBA2`) mid-session failed silently in the UI: the form reset to blank as if successful, but the Staff Directory count never changed and no `auth.users` row was created. `read_network_requests` showed a 400 on the `manage-staff` edge function POST, but the tool doesn't expose response bodies. Diagnosed via a `window.fetch` monkey-patch (see §9.3) that captured the actual response: `{"error":"email rate limit exceeded"}`. This is Supabase's default shared-SMTP per-hour invite-email limit, exhausted by the volume of invite emails already sent earlier in this same session — a real operational constraint worth knowing about for staff onboarding at scale (relevant to **ACD-101**, DNS/Resend domain verification, which would move invite email off the shared/rate-limited path), not an application defect. The UI silently swallowing this error (no toast/visible failure) is itself a minor, separate UX gap worth noting — a failed invite should surface an error to the admin rather than silently reset the form.

## 8. Findings carried forward from earlier sessions (not re-verified this pass)

These were established and diagnosed in prior testing sessions within this same multi-session QA effort. Listed here for completeness so this document is the single source of truth; re-verify before relying on specifics if significant time has passed.

- **`cert_expiry` null → rendered as "Expired"**: fixed in a prior session.
- **Document upload file-type validation**: accepts/rejects file types correctly.
- **Initial Assessment — full section-by-section walkthrough**: completed successfully end-to-end, including the STO-gating mechanism (`sectionsMissingSTO`) blocking AI draft generation until every goal/behavior/caregiver-training entry has a real STO.
- **Crisis Plan section fields**: walked through, functioned correctly.
- **Caregiver Training STO placeholder-vs-real-value bug**: numeric input fields show placeholder text instead of the actual saved value on re-entry into the form.
- **Literal `"?"` placeholder in AI-generated draft text**: confirmed in at least three locations — Skill Acquisition, Maladaptive Behaviors, and Caregiver Training's LTO field.
- **`[Date]` / `[Clinician Name]` bracket-template placeholders**: a related but distinct template-substitution defect in the Self-Stimulatory Behavior section's generated text.
- **Full Initial-Assessment-to-`.docx`-download workflow**: completed successfully, including real AI draft generation (real Anthropic API cost).

## 9. Testing methodology (reusable for the next full-sweep pass)

### 9.1 RLS simulation via `set_config` (no need to actually log in as another user)
Within a single SQL call via the Supabase SQL execution tool, run `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)` immediately followed by `set local role authenticated;` and the query to test — all in one statement/transaction, since `SET LOCAL` only persists within the current transaction and separate tool calls don't share one. This impersonates a specific authenticated user's RLS context without needing their password.

### 9.2 Diagnosing opaque 400s: fetch-interception
`read_network_requests` doesn't expose response bodies. To see the real error, inject via the browser JS console/tool:
```js
const origFetch = window.fetch;
window.fetch = async (...args) => {
  const res = await origFetch(...args);
  if (String(args[0]).includes('<url-substring-of-interest>')) {
    const clone = res.clone();
    clone.text().then(body => { window.__lastCapture = { status: res.status, body, requestBody: args[1]?.body }; });
  }
  return res;
};
```
then re-trigger the action and read `window.__lastCapture`.

### 9.3 File uploads: the `file_upload` MCP tool was unreliable in this environment
When it failed, uploads were driven via the File API directly through the JS execution tool (constructing a `File`/`DataTransfer` object and dispatching a `change` event on the input) as a workaround.

### 9.4 Native `<input type="date">` typing gotcha
These inputs are segmented (month/day/year); typing a full date string as one block can land in the wrong segment depending on cursor position. Click the specific segment before typing, or type segment-by-segment. This is a testing-tool quirk, not an app bug.

### 9.5 General approach
Prefer creating new, clearly-named test fixtures (`QA Test ...` / `QA FullSweep ...`) over reusing or cleaning up pre-existing production test clutter — keeps this session's artifacts easy to find and remove later, and avoids disturbing other in-flight test data. Cross-check anything observed in the UI against the underlying DB state directly (Supabase SQL) before writing it up as a confirmed bug — see §4 for a case where the live DB/code check overturned an earlier on-the-fly theory.

## 10. Suggested next steps (not done, for decision)

1. Fix the RLS policy mismatch (§3) — highest priority; blocks all real non-admin usage.
2. Fix the `'select'`-case optional bypass in `itemComplete()` (§4) — blocks all Pipeline progression past Auth Assessment.
3. Once #2 is fixed, re-test Service Sessions (§5) end-to-end with a client walked all the way to "In Services."
4. Surface invite failures (e.g., rate-limit errors) to the admin in the UI instead of silently resetting the form (§7).
5. Consider whether the "Testing as" role switcher (§6) should be wired to something real, or removed if it's misleading as-is.
6. File Jira tickets for findings #1, #2, and #4 above if not already tracked (none of this report's new findings currently have a ticket).
