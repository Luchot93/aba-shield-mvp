import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth.js';

// Live coverage of the shipped Alpha Clients page: create + search. Counts are
// asserted relative to the seeded baseline (never absolute) so the test stays
// valid if seedData.js changes.

const ROWS = '[data-testid^="client-row-"]';

test.describe('Clients', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
  });

  test('create a client via the New Client modal adds a row', async ({ page }) => {
    const before = await page.locator(ROWS).count();

    await page.getByTestId('clients-new-btn').click();
    await page.getByTestId('new-client-modal').waitFor();

    const name = 'Testcase Playwright Child';
    await page.getByTestId('field-name').fill(name);
    await page.getByTestId('field-dob').fill('2020-02-15');
    await page.getByTestId('field-insurer_name').fill('Aetna');
    await page.getByTestId('field-member_id').fill('E2E-TEST-0001');
    await page.getByTestId('save-client').click();

    await expect(page.getByTestId('new-client-modal')).not.toBeVisible();
    await expect(page.locator(ROWS)).toHaveCount(before + 1);
    await expect(page.getByText(name)).toBeVisible();
  });

  test('search narrows the client list to a matching name', async ({ page }) => {
    // Seeded client — search for a distinctive substring of the name. Scope the
    // name assertion to the results rows: the name also appears in the "N of M
    // clients matching …" summary text, so an unscoped getByText matches twice
    // and trips Playwright strict mode.
    await page.getByTestId('clients-search').fill('Liam Rodriguez');
    await expect(page.locator(ROWS).getByText('Liam Rodriguez')).toBeVisible();
    await expect(page.locator(ROWS)).toHaveCount(1);

    // A search that matches nothing empties the table.
    await page.getByTestId('clients-search').fill('zzz-no-such-client');
    await expect(page.locator(ROWS)).toHaveCount(0);
  });

});
