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
// this browser module).
export const E2E_ADMIN = { email: 'admin@abashield.com', password: 'test-e2e-password' };

const ADMIN_USER = { id: 'u1', email: E2E_ADMIN.email, user_metadata: {}, app_metadata: {} };

function makeSession() {
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: ADMIN_USER,
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
      if (email === E2E_ADMIN.email && password === E2E_ADMIN.password) {
        currentSession = makeSession();
        // Real Supabase fires SIGNED_IN asynchronously AFTER signIn resolves; the
        // async tick guarantees App's onAuthStateChange listener (registered on
        // mount) receives it.
        setTimeout(() => authCb?.('SIGNED_IN', currentSession), 0);
        return { data: { session: currentSession, user: ADMIN_USER }, error: null };
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
      return { data: { user: ADMIN_USER }, error: null };
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
