// Mock Supabase client for E2E mode (VITE_E2E=1). Only `auth` and `storage` are
// mocked — those are the two surfaces consumed directly off `supabase.*` (App.jsx,
// LoginPage, SetPasswordPage, AssessmentFeature). All table access goes through
// db.js, which branches to the in-memory store in E2E, so `.from()` is never
// reached here.
//
// Loaded ONLY when IS_E2E is true (supabase.js ternary), so this file — and its
// import of ./store.js — never executes in a production build.
import { resetStore } from './store.js';

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

  return { auth, storage };
}
