// Shared Playwright login helper for the E2E suite (VITE_E2E=1 backend-free mode).
//
// E2E_ADMIN/E2E_BCBA/E2E_RBT must stay identical to the credentials hardcoded in
// src/lib/e2e/mockSupabase.js. We deliberately duplicate them here instead of
// importing that module: mockSupabase.js pulls in ./store.js → seedData.js, which
// touches import.meta.env and would blow up under Node/ESM when Playwright loads
// the spec.
export const E2E_ADMIN = { email: 'admin@abashield.com', password: 'test-e2e-password' };
export const E2E_BCBA  = { email: 'ana@abashield.com',   password: 'test-e2e-password' };
export const E2E_RBT   = { email: 'james@abashield.com', password: 'test-e2e-password' };

// Logs in and waits for the Clients page. Alpha lands on Clients after auth (NOT
// metrics-page — that flag is off, which is what hung the old inline helper).
async function login(page, creds) {
  await page.goto('/');
  await page.getByTestId('login-submit').waitFor();
  await page.fill('input[type=email]', creds.email);
  await page.fill('input[type=password]', creds.password);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('clients-page').waitFor();
}

export async function loginAsAdmin(page) { await login(page, E2E_ADMIN); }
export async function loginAsBCBA(page)  { await login(page, E2E_BCBA); }
export async function loginAsRBT(page)   { await login(page, E2E_RBT); }
