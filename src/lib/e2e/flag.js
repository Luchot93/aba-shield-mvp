// E2E backend-free test mode. Orthogonal to VITE_DEMO_MODE (which only gates AI
// draft generation). When VITE_E2E === '1', supabase.js swaps in a mock client
// and db.js branches to an in-memory store — so Playwright runs with no secrets
// and no real backend.
//
// The `import.meta.env.PROD !== true` clause forces the mock OFF in any production
// build even if VITE_E2E leaks into the build env: `vite build` sets PROD=true.
// This is belt-and-suspenders on top of Rollup's dead-code elimination of the
// statically-false ternary arm in supabase.js.
export const IS_E2E =
  import.meta.env.VITE_E2E === '1' && import.meta.env.PROD !== true;
