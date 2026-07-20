import { test, expect } from '@playwright/test';
import { FLAGS } from '../src/constants/featureFlags.js';
import { loginAsAdmin } from './helpers/auth.js';

// Reassessment is Phase-2 (FLAGS.REASSESSMENT, off in Alpha). Whole block
// auto-skips while the flag is off and runs unmodified once it flips true.
const gated = (flag) => (flag ? test.describe : test.describe.skip);

async function openClientTab(page, clientName, tabName) {
  await page.getByText(clientName).first().click();
  await page.getByRole('button', { name: new RegExp(tabName) }).click();
}

gated(FLAGS.REASSESSMENT)('Reassessment — Submission Checklist (Reauth tab)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Client detail (where the Reassessment tab lives) is reached via Pipeline.
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.waitForSelector('[data-testid="new-client-btn"]');
  });

  // ── Reassessment tab: locked state (Charlotte Davis — status: in_progress) ─

  test('Charlotte Davis: reassessment panel shows locked state in Reassessment tab', async ({ page }) => {
    await openClientTab(page, 'Charlotte Davis', 'Reassessment');
    await expect(page.getByText('Clinical summary locked')).toBeVisible();
    await expect(page.getByText('Complete and download the reassessment document')).toBeVisible();
  });

  test('Charlotte Davis: no progress narrative shown while locked', async ({ page }) => {
    await openClientTab(page, 'Charlotte Davis', 'Reassessment');
    // PROGRESS NARRATIVE is unique to HeaderStrip — must not appear while locked
    await expect(page.getByText('PROGRESS NARRATIVE', { exact: true })).not.toBeVisible();
    // Clinical summary sections must not appear
    await expect(page.getByText('CLINICAL SUMMARY · CYCLE DATA', { exact: true })).not.toBeVisible();
  });

  // ── Reauth tab: checklist NOT shown without a completed reassessment ────────

  test('Charlotte Davis: reauth submission checklist is NOT shown (no completed reassessment)', async ({ page }) => {
    await openClientTab(page, 'Charlotte Davis', 'Reauthorization');
    await expect(page.getByText('Reauthorization Submission')).not.toBeVisible();
    await expect(page.getByText('Vineland-3 graphs manually added to report')).not.toBeVisible();
  });

  // ── Reauth tab: checklist shown once reassessment is complete ─────────────

  test('Sofia Ramirez: reauth tab shows submission checklist (completed reassessment)', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reauthorization');
    await expect(page.getByText('Reauthorization Submission')).toBeVisible();
    await expect(page.getByText('Vineland-3 graphs manually added to report')).toBeVisible();
    await expect(page.getByText('BASC-3 graphs manually added to report')).toBeVisible();
    await expect(page.getByText('Final signed progress report uploaded')).toBeVisible();
  });

  test('Sofia Ramirez: checklist NOT in Reassessment tab (moved to Reauth tab)', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reassessment');
    // Scroll to the bottom of the clinical summary
    const container = page.locator('.fixed.inset-0.z-40.overflow-y-auto');
    await container.evaluate(el => el.scrollTop = el.scrollHeight);
    await expect(page.getByText('Reauthorization Submission')).not.toBeVisible();
  });

  // ── Reauth tab: checkbox interaction ─────────────────────────────────────

  test('Sofia Ramirez: Vineland checkbox toggles on click in Reauth tab', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reauthorization');
    const vinelandLabel = page.getByText('Vineland-3 graphs manually added to report');
    await expect(vinelandLabel).toBeVisible();
    await expect(vinelandLabel).not.toHaveClass(/line-through/);
    await vinelandLabel.click();
    await expect(vinelandLabel).toHaveClass(/line-through/);
  });

  test('Sofia Ramirez: BASC-3 checkbox toggles on click in Reauth tab', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reauthorization');
    const bascLabel = page.getByText('BASC-3 graphs manually added to report');
    await expect(bascLabel).toBeVisible();
    await expect(bascLabel).not.toHaveClass(/line-through/);
    await bascLabel.click();
    await expect(bascLabel).toHaveClass(/line-through/);
  });

  test('Sofia Ramirez: "Ready" banner appears when all three items completed', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reauthorization');
    await expect(page.getByText('Ready for reauthorization submission')).not.toBeVisible();
    await page.getByText('Vineland-3 graphs manually added to report').click();
    await page.getByText('BASC-3 graphs manually added to report').click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'Sofia_Final_Report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf'),
    });
    await expect(page.getByText('Ready for reauthorization submission')).toBeVisible();
  });

  // ── Pipeline card-style checkboxes ───────────────────────────────────────

  test('Stage checklist checkboxes use card style (no native input[type=checkbox])', async ({ page }) => {
    await page.getByText('Liam Rodriguez').first().click();
    // No native checkboxes with accent-teal-600 class should exist
    await expect(page.locator('input.accent-teal-600')).toHaveCount(0);
    // Card-style checkbox divs should be present
    const cards = page.locator('[class*="hover:border-teal-200"]');
    await expect(cards.first()).toBeVisible();
  });

  // ── Reassessment cycle gate ──────────────────────────────────────────────

  test('Sofia Ramirez: no "+ Start Reassessment" button after completed cycle', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reassessment');
    // Sofia has a completed reassessment — "+ Start Reassessment" must NOT appear
    await expect(page.getByRole('button', { name: '+ Start Reassessment' })).not.toBeVisible();
  });

  test('Sofia Ramirez: completed reassessment shows "Reassessment complete" notice instead', async ({ page }) => {
    await openClientTab(page, 'Sofia Ramirez', 'Reassessment');
    await expect(page.getByText('Reassessment complete.')).toBeVisible();
  });

  test('Charlotte Davis: "Continue Reassessment →" shown while cycle is in progress', async ({ page }) => {
    await openClientTab(page, 'Charlotte Davis', 'Reassessment');
    await expect(page.getByRole('button', { name: 'Continue Reassessment →' })).toBeVisible();
  });

});
