// Shared Playwright login helper for the E2E suite (VITE_E2E=1 backend-free mode).
//
// E2E_ADMIN must stay identical to the credential hardcoded in
// src/lib/e2e/mockSupabase.js. We deliberately duplicate it here instead of
// importing that module: mockSupabase.js pulls in ./store.js → seedData.js, which
// touches import.meta.env and would blow up under Node/ESM when Playwright loads
// the spec.
export const E2E_ADMIN = { email: 'admin@abashield.com', password: 'test-e2e-password' };

// Logs in and waits for the Clients page. Alpha lands on Clients after auth (NOT
// metrics-page — that flag is off, which is what hung the old inline helper).
export async function loginAsAdmin(page) {
  await page.goto('/');
  await page.getByTestId('login-submit').waitFor();
  await page.fill('input[type=email]', E2E_ADMIN.email);
  await page.fill('input[type=password]', E2E_ADMIN.password);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('clients-page').waitFor();
}
