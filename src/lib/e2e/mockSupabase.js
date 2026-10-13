// Mock Supabase client for E2E mode (VITE_E2E=1). Only `auth` and `storage` are
// mocked — those are the two surfaces consumed directly off `supabase.*` (App.jsx,
// LoginPage, SetPasswordPage, AssessmentFeature). All table access goes through
// db.js, which branches to the in-memory store in E2E, so `.from()` is never
// reached here.
//
// Loaded ONLY when IS_E2E is true (supabase.js ternary), so this file — and its
// import of ./store.js — never executes in a production build.
import { resetStore, insertStaffRow, removeStaffRow, listStaff } from './store.js';

// Shared with tests/helpers/auth.js (kept identical there; specs must not import
// this browser module). Three fixed accounts, one per role the Playwright suite
// needs to exercise (ACD-93) — ids match the staff fixtures in seedData.js so
// store.getProfileFor() and the clients' bcba_id/rbt_id assignments resolve to
// the right person.
export const E2E_ADMIN = { email: 'admin@abashield.com', password: 'test-e2e-password' };
export const E2E_BCBA  = { email: 'ana@abashield.com',   password: 'test-e2e-password' };
export const E2E_RBT   = { email: 'james@abashield.com', password: 'test-e2e-password' };

const USERS = [
  { id: 'u1', ...E2E_ADMIN },
  { id: 'u2', ...E2E_BCBA },
  { id: 'u4', ...E2E_RBT },
];

function toAuthUser({ id, email }) {
  return { id, email, user_metadata: {}, app_metadata: {} };
}

function makeSession(user) {
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user,
  };
}

export function createMockSupabaseClient() {
  if (import.meta.env.PROD) throw new Error('E2E mock Supabase client loaded in a production build');

  // Register the per-test reset hook at app boot (register only — do NOT call it,
  // or a mid-test page reload would wipe auto-saved data before assertions).
  if (typeof window !== 'undefined') window.__E2E_RESET__ = resetStore;

  let currentSession = null;
  let authCb = null;

  const auth = {
    async signInWithPassword({ email, password }) {
      const match = USERS.find(u => u.email === email && u.password === password);
      if (match) {
        const user = toAuthUser(match);
        currentSession = makeSession(user);
        // Real Supabase fires SIGNED_IN asynchronously AFTER signIn resolves; the
        // async tick guarantees App's onAuthStateChange listener (registered on
        // mount) receives it.
        setTimeout(() => authCb?.('SIGNED_IN', currentSession), 0);
        return { data: { session: currentSession, user }, error: null };
      }
      return {
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      };
    },
    async getSession() {
      return { data: { session: currentSession }, error: null };
    },
    async getUser() {
      return { data: { user: currentSession?.user ?? null }, error: null };
    },
    onAuthStateChange(cb) {
      authCb = cb;
      return { data: { subscription: { unsubscribe() { authCb = null; } } } };
    },
    async signOut() {
      currentSession = null;
      setTimeout(() => authCb?.('SIGNED_OUT', null), 0);
      return { error: null };
    },
    async updateUser() {
      return { data: { user: currentSession?.user ?? null }, error: null };
    },
  };

  const storage = {
    from() {
      return {
        async upload() { return { data: { path: 'e2e/mock' }, error: null }; },
      };
    },
  };

  // Mocks the `manage-staff` edge function (invite/revoke) closely enough for
  // the happy + validation-error paths exercised by StaffPage.jsx and
  // BulkInvitePanel.jsx to behave like production. See functionError.js for
  // the error-message strings these responses are translated into.
  const ALLOWED_ROLES = ['admin', 'bcba', 'bcaba', 'rbt'];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NPI_RE = /^\d{10}$/;

  function manageStaffInvite(body) {
    const { name, email, phone, role, cert_number, cert_expiry, npi, hire_date } = body;
    if (!name || !email) return { data: null, error: { message: 'name and email are required' } };
    if (!EMAIL_RE.test(email)) return { data: null, error: { message: 'invalid email address' } };
    if (!ALLOWED_ROLES.includes(role)) {
      return { data: null, error: { message: `role must be one of ${ALLOWED_ROLES.join(', ')}` } };
    }
    if (npi && !NPI_RE.test(npi)) return { data: null, error: { message: 'npi must be exactly 10 digits' } };
    if (listStaff().some(s => s.email === email)) {
      return { data: null, error: { message: 'a staff member with that email is already registered' } };
    }
    const rec = insertStaffRow({
      name, email, phone: phone ?? '', role,
      cert_number: cert_number ?? '', cert_expiry: cert_expiry || null,
      npi: npi ?? '', hire_date: hire_date || null,
      status: 'pending',
    });
    return { data: { staff: rec }, error: null };
  }

  function manageStaffRevoke(body) {
    const { staffId } = body;
    if (!staffId) return { data: null, error: { message: 'staffId is required' } };
    if (!listStaff().some(s => s.id === staffId)) {
      return { data: null, error: { message: 'staff record not found' } };
    }
    removeStaffRow(staffId);
    return { data: { success: true }, error: null };
  }

  const functions = {
    async invoke(name, opts) {
      const body = opts?.body ?? {};
      if (name === 'manage-staff') {
        if (body.action === 'invite') return manageStaffInvite(body);
        if (body.action === 'revoke') return manageStaffRevoke(body);
        return { data: null, error: { message: `unknown action: ${body.action}` } };
      }
      // Other functions (e.g. send-notification-email) are fire-and-forget
      // in every caller — a safe no-op success keeps those call sites quiet.
      return { data: { success: true }, error: null };
    },
  };

  return { auth, storage, functions };
}
