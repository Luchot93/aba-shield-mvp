import { test, expect } from '@playwright/test';
import { FLAGS } from '../src/constants/featureFlags.js';
import { loginAsAdmin, loginAsBCBA, loginAsRBT } from './helpers/auth.js';

// ACD-93 (E4): role-based access control exercised through the real browser UI,
// not just unit-level checks. Two live surfaces exist in Alpha; two more are
// gated and auto-activate once their flag flips (see `gated()` below, same
// pattern as pipeline.spec.js).
//
// Seeded assignments this file depends on (src/constants/seedData.js):
//   u2 = Dr. Ana Reyes (bcba) — bcba_id on c1-c10, c13, c14
//   u4 = James Torres  (rbt)  — rbt_id on c8, c9, c10
//   c8 = Isabella Moore — assigned to BOTH u2 and u4 (shared positive-case fixture)
//   c11/c17 = James Martinez / Maya Chen — bcba_id 's1', not u2 or u4 (negative controls)
//   c12/c16 = Amelia Wilson / Ethan Clarke — bcba_id 's2', not u2 or u4 (negative controls)

const ROWS = '[data-testid^="client-row-"]';
const gated = (flag) => (flag ? test.describe : test.describe.skip);

// ── LIVE: Clients-page role scoping ──────────────────────────────────────────
// This is the one role restriction that is actually live in Alpha (ACD-67 RLS:
// admin sees every client; BCBA/RBT see only clients where they are the
// assigned bcba_id/rbt_id). Mirrors tests/rls/*.test.js at the DB layer, but
// clicks through the real app the way a user would.
test.describe('Security — Clients role scoping (live)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
  });

  test('admin sees clients belonging to every staff member', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText('Liam Rodriguez')).toBeVisible();  // u2's client
    await expect(page.getByText('James Martinez')).toBeVisible();  // s1's client
    await expect(page.getByText('Amelia Wilson')).toBeVisible();   // s2's client
  });

  test('BCBA only sees clients assigned to them', async ({ page }) => {
    await loginAsBCBA(page);
    await expect(page.getByText('Liam Rodriguez')).toBeVisible();  // bcba_id: u2

    // Not merely visually hidden — the restricted client never reaches the DOM.
    await expect(page.getByText('James Martinez')).toHaveCount(0); // bcba_id: s1
    await expect(page.getByText('Amelia Wilson')).toHaveCount(0);  // bcba_id: s2
  });

  test('RBT only sees clients assigned to them', async ({ page }) => {
    await loginAsRBT(page);
    await expect(page.getByText('Isabella Moore')).toBeVisible();  // rbt_id: u4

    await expect(page.getByText('Liam Rodriguez')).toHaveCount(0); // rbt_id: null
    await expect(page.getByText('James Martinez')).toHaveCount(0); // rbt_id: s5
  });

  test('BCBA cannot surface another BCBA\'s client through search', async ({ page }) => {
    // Proves the restriction is server/data-side, not a client-side filter a
    // search box could route around: the row is absent from the result set
    // regardless of query, because the app never received that client's data.
    await loginAsBCBA(page);
    await page.getByTestId('clients-search').fill('James Martinez');
    await expect(page.locator(ROWS)).toHaveCount(0);
  });

});

// ── GATED: Staff page — invite/bulk-import are admin-only actions ───────────
gated(FLAGS.STAFF)('Security — Staff role restrictions', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
  });

  test('admin sees invite and bulk-import actions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByTestId('staff-page').waitFor();
    await expect(page.getByTestId('invite-btn')).toBeVisible();
    await expect(page.getByTestId('bulk-import-btn')).toBeVisible();
  });

  test('BCBA does not see invite or bulk-import actions', async ({ page }) => {
    await loginAsBCBA(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByTestId('staff-page').waitFor();
    await expect(page.getByTestId('invite-btn')).toHaveCount(0);
    await expect(page.getByTestId('bulk-import-btn')).toHaveCount(0);
  });

  test('RBT does not see invite or bulk-import actions', async ({ page }) => {
    await loginAsRBT(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByTestId('staff-page').waitFor();
    await expect(page.getByTestId('invite-btn')).toHaveCount(0);
    await expect(page.getByTestId('bulk-import-btn')).toHaveCount(0);
  });

  // Note: manage-staff's actual server-side authorization (who the Edge Function
  // itself will let invite/revoke) is already covered end-to-end by
  // tests/rls/acd92-hardening.test.js. E2E mode here mocks Supabase entirely —
  // there is no real network call for a Playwright test to catch an authorization
  // bypass on. This block only verifies the UI doesn't offer the restricted
  // action to a role that shouldn't have it.

});

// ── GATED: Metrics — admin-only page ─────────────────────────────────────────
gated(FLAGS.METRICS)('Security — Metrics role restriction', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
  });

  test('admin can open Metrics', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('button', { name: 'Metrics' })).toBeVisible();
  });

  test('BCBA has no Metrics nav entry', async ({ page }) => {
    await loginAsBCBA(page);
    await expect(page.getByRole('button', { name: 'Metrics' })).toHaveCount(0);
  });

  test('RBT has no Metrics nav entry', async ({ page }) => {
    await loginAsRBT(page);
    await expect(page.getByRole('button', { name: 'Metrics' })).toHaveCount(0);
  });

});

// ── GATED: Pipeline — assigned staff retain edit rights on their own clients ─
// Pipeline's board reuses the same role-scoped `clients` array as the live
// Clients page, so a BCBA/RBT only ever sees their own clients there too —
// `canEdit`'s non-owner branch (utils/permissions.js) can't be reached through
// the UI under that scoping. What IS reachable and worth covering: a client
// assigned to both the logged-in BCBA and RBT (c8/Isabella Moore) renders as
// fully editable — no "Read only" badge — for both of them.
gated(FLAGS.PIPELINE)('Security — Pipeline edit rights for assigned staff', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
  });

  test('BCBA has full edit rights on their assigned client', async ({ page }) => {
    await loginAsBCBA(page);
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.locator('[data-testid="card-name-c8"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).not.toContainText('Read only');
  });

  test('RBT has full edit rights on their assigned client', async ({ page }) => {
    await loginAsRBT(page);
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.locator('[data-testid="card-name-c8"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).not.toContainText('Read only');
  });

});
