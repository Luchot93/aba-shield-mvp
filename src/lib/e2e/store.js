// In-memory data store for E2E mode (VITE_E2E=1). Backs db.js's 9 functions with
// no real Supabase. Seeded from the existing seedData.js fixtures.
//
// IMPORTANT: this module must stay SIDE-EFFECT-FREE at top level (only declarations)
// so that in a production build — where every `if (IS_E2E)` branch in db.js is
// statically false — Rollup tree-shakes this module out entirely. All seeding,
// localStorage access, and the production guard live inside functions that only
// run when a db.js function is actually called, which only happens when IS_E2E.
import { SEED_CLIENTS, SEED_STAFF } from '../../constants/seedData.js';

const LS_KEY = 'aba_e2e_store';
const ADMIN = { id: 'u1', full_name: 'Admin User', email: 'admin@abashield.com', role: 'admin' };

// Inverse of db.js fromDbRow + SESSION_FIELD_MAP: convert an app-shape (camelCase)
// assessment_session fixture into the snake_case DB row shape the store holds, so
// db.js's real fromDbRow transform runs on read (exercises the prod code path).
function sessionToDbRow(s, clientId) {
  return {
    id: s.id ?? `sess-${clientId}`,
    client_id: clientId,
    bcba_id: ADMIN.id, // owned by the seeded admin so getAssessmentSessionsByBcba(u1) returns it
    session_type: s.sessionType ?? 'initial',
    created_at: s.createdAt ?? new Date().toISOString(),
    updated_at: s.updatedAt ?? new Date().toISOString(),
    sections: s.sections ?? {},
    status: s.status ?? 'not_started',
    sections_with_data: s.sectionsWithData ?? 0,
    sections_approved: s.sectionsApproved ?? 0,
    documents: s.documents ?? [],
    client_profile: s.clientProfile ?? null,
    result: s.result ?? null,
    consent_granted: s.consentGranted ?? false,
    consent_granted_at: s.consentGrantedAt ?? null,
    progress_narrative_text: s.progressNarrativeText ?? null,
    client_name: s.clientName ?? null,
    bcba_name: s.bcbaName ?? null,
  };
}

// Staff rows keyed by `id` (matches how client.bcba_id/rbt_id are compared
// directly against staff ids elsewhere in the app — seed fixtures have no
// separate user_id). `user_id` is added as an alias of `id` so getStaffByUserIds'
// `.in('user_id', ids)` filter (mirrored here) resolves the same records.
function freshSeed() {
  const seeds = SEED_CLIENTS();
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  const clients = [];
  const sessions = [];
  seeds.forEach((c, i) => {
    const { assessment_session, ...rest } = c;
    // created_at descending by seed index → deterministic order (getClients sorts desc).
    clients.push({ ...rest, user_id: ADMIN.id, created_at: new Date(base - i * 60000).toISOString() });
    if (assessment_session) sessions.push(sessionToDbRow(assessment_session, c.id));
  });
  const staff = SEED_STAFF().map(s => ({ ...s, user_id: s.id }));
  return { clients, sessions, staff, activityLog: [], seq: 0 };
}

let state = null;

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function ensureInit() {
  // Defensive: this code path is unreachable in a production build (IS_E2E gates
  // every caller, and IS_E2E requires PROD !== true), but fail loud if it ever runs.
  if (import.meta.env.PROD) throw new Error('E2E store initialized in a production build');
  if (state) return;
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { /* ignore */ }
  if (raw) {
    try { state = JSON.parse(raw); } catch { state = null; }
  }
  if (!state || !Array.isArray(state.clients)) {
    state = freshSeed();
    persist();
  } else {
    // Backfill: a store persisted before the staff/activityLog fields existed
    // (e.g. a browser profile with older localStorage) won't have them —
    // add without wiping already-seeded clients/sessions.
    let changed = false;
    if (!Array.isArray(state.staff)) { state.staff = SEED_STAFF().map(s => ({ ...s, user_id: s.id })); changed = true; }
    if (!Array.isArray(state.activityLog)) { state.activityLog = []; changed = true; }
    if (changed) persist();
  }
}

function nextId(prefix) { state.seq += 1; return `${prefix}-e2e-${state.seq}`; }

// --- Clients (raw snake_case rows; db.js applies enrichClient) ---
// Mirrors the production RLS policy from ACD-67 ("clients select admin or
// assigned"): admin sees every client; everyone else only sees clients where
// they're the assigned bcba_id or rbt_id. NOT ownership (user_id) — that
// policy was dropped in the ACD-67 migration.
export function listClients(userId) {
  ensureInit();
  const isAdminUser = userId === ADMIN.id;
  return state.clients
    .filter(c => isAdminUser || c.bcba_id === userId || c.rbt_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
export function insertClient(row) {
  ensureInit();
  const rec = { id: nextId('client'), created_at: new Date().toISOString(), ...row };
  state.clients.push(rec);
  persist();
  return rec;
}
export function insertClients(rows) {
  ensureInit();
  const recs = rows.map(row => ({ id: nextId('client'), created_at: new Date().toISOString(), ...row }));
  state.clients.push(...recs);
  persist();
  return recs;
}
export function removeClient(clientId) {
  ensureInit();
  state.clients = state.clients.filter(c => c.id !== clientId);
  state.sessions = state.sessions.filter(s => s.client_id !== clientId);
  persist();
}

// --- Profile ---
// ids/names/roles match the staff fixtures in seedData.js (u1 admin, u2 bcba,
// u4 rbt) so the role-scoped Pipeline/Staff Playwright tests (ACD-93) see a
// real, recognizable person rather than a generic stand-in.
const PROFILES = {
  u1: { role: ADMIN.role, full_name: ADMIN.full_name },
  u2: { role: 'bcba', full_name: 'Dr. Ana Reyes' },
  u4: { role: 'rbt', full_name: 'James Torres' },
};

export function getProfileFor(userId) {
  ensureInit();
  return PROFILES[userId] ?? { role: 'bcba', full_name: 'E2E User' };
}

// --- Assessment sessions (raw snake_case rows; db.js applies fromDbRow) ---
export function sessionsByBcba(bcbaId) {
  ensureInit();
  return state.sessions.filter(s => s.bcba_id === bcbaId);
}
export function sessionByClient(clientId) {
  ensureInit();
  return state.sessions.find(s => s.client_id === clientId) ?? null;
}
export function insertSession(row) {
  ensureInit();
  const now = new Date().toISOString();
  const rec = { id: nextId('sess'), created_at: now, updated_at: now, session_type: 'initial', ...row };
  state.sessions.push(rec);
  persist();
  return rec;
}
export function updateSession(sessionId, patch) {
  ensureInit();
  const s = state.sessions.find(x => x.id === sessionId);
  if (s) Object.assign(s, patch);
  persist();
}

// --- Staff (raw rows; mirrors the real `staff` table) ---
export function listStaff() {
  ensureInit();
  // Return a copy, not the live array reference: getStaff() -> App.jsx stores this
  // directly in React state, and handleInvite's optimistic setStaff(prev => [...prev, row])
  // closes over that same `prev` array. If this returned the live reference, a later
  // insertStaffRow() push (which mutates state.staff in place) would already be reflected
  // in `prev` by the time the optimistic append ran, duplicating the just-invited row.
  return [...state.staff];
}
export function insertStaffRow(row) {
  ensureInit();
  const id = row.id ?? nextId('staff');
  const rec = { status: 'pending', ...row, id, user_id: row.user_id ?? id };
  state.staff.push(rec);
  persist();
  return rec;
}
export function updateStaffRow(staffId, patch) {
  ensureInit();
  const s = state.staff.find(x => x.id === staffId);
  if (!s) return null;
  Object.assign(s, patch);
  persist();
  return s;
}
export function removeStaffRow(staffId) {
  ensureInit();
  state.staff = state.staff.filter(s => s.id !== staffId);
  persist();
}
export function staffByUserIds(userIds) {
  ensureInit();
  const ids = new Set(userIds);
  return state.staff.filter(s => ids.has(s.user_id));
}

// --- Clients: patch (mirrors updateClient) ---
export function updateClientRow(clientId, patch) {
  ensureInit();
  const c = state.clients.find(x => x.id === clientId);
  if (!c) return null;
  Object.assign(c, patch);
  persist();
  return c;
}

// --- Activity log (raw rows; mirrors the real `activity_log` table) ---
export function insertActivityLog(row) {
  ensureInit();
  const rec = { id: nextId('activity'), created_at: new Date().toISOString(), ...row };
  state.activityLog.push(rec);
  persist();
  return rec;
}

// Test hook: wipe persisted store + reseed for per-test isolation. Registered on
// window by mockSupabase.js at app boot (E2E only). Does NOT run on plain page
// reload, so auto-save persistence across reload still works within a test.
export function resetStore() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  state = freshSeed();
  persist();
}
