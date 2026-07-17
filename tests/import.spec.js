import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth.js';

// Live coverage of the shipped CSV import flow (upload → auto-map → preview →
// submit). Uses an in-memory CSV buffer so there are no fixture files on disk.
// NOTE: ImportPanel loads PapaParse from cdnjs at runtime, so this spec needs
// network access to that CDN (available in GitHub Actions).

const CSV_HEADERS = 'Client name,Date of birth,Insurer name,Member ID,Referral date';

function csvBuffer(rows) {
  return Buffer.from([CSV_HEADERS, ...rows].join('\n'), 'utf-8');
}

async function uploadCsv(page, buffer) {
  await page.getByTestId('import-btn').click();
  await page.getByTestId('import-panel').waitFor();
  await page.getByTestId('import-panel').locator('input[type=file]')
    .setInputFiles({ name: 'clients.csv', mimeType: 'text/csv', buffer });
  // Auto-mapping recognizes all required columns → mapping step, then preview.
  await page.getByTestId('import-mapping').waitFor();
  await page.getByRole('button', { name: /Preview/ }).click();
  await page.getByTestId('import-preview').waitFor();
}

test.describe('Import', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
  });

  test('CSV happy path imports new clients into the directory', async ({ page }) => {
    const before = await page.locator('[data-testid^="client-row-"]').count();
    await uploadCsv(page, csvBuffer([
      'Playwright Import One,2020-01-10,Aetna,E2E-IMP-1001,2026-05-01',
      'Playwright Import Two,2019-06-20,Cigna,E2E-IMP-1002,2026-05-02',
    ]));

    await expect(page.getByTestId('import-summary')).toContainText('2 new clients ready');
    await page.getByTestId('import-submit').click();

    await expect(page.getByTestId('import-toast')).toContainText('2 clients added to client directory');
    await expect(page.locator('[data-testid^="client-row-"]')).toHaveCount(before + 2);
    await expect(page.getByText('Playwright Import One')).toBeVisible();
  });

  test('duplicate member ID is flagged as already in system', async ({ page }) => {
    // AET-884421 is seeded client c1 (Liam Rodriguez) → exact Member ID match.
    await uploadCsv(page, csvBuffer([
      'Brand New Kid,2021-03-03,Humana,E2E-IMP-2001,2026-05-05',
      'Duplicate Kid,2018-03-15,Aetna,AET-884421,2026-05-06',
    ]));

    const summary = page.getByTestId('import-summary');
    await expect(summary).toContainText('1 new client ready');
    await expect(summary).toContainText('1 already in system');
  });

});
