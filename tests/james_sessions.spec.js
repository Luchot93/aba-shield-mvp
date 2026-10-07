import { test, expect } from '@playwright/test';
import { FLAGS } from '../src/constants/featureFlags.js';
import { loginAsAdmin } from './helpers/auth.js';

// Session logging is Phase-2 (FLAGS.SESSION_LOG, off in Alpha). This whole block
// auto-skips while the flag is off and runs unmodified once it flips true.
const gated = (flag) => (flag ? test.describe : test.describe.skip);

// TODO(ACD-113): this whole file tests the old in-tab session logging UI, which
// ACD-87/ACD-88 replaced with the standalone Service Sessions page. FLAGS.SESSION_LOG
// itself was removed as dead code in ACD-89. Porting this requires extending the
// E2E mock store to back session-log reads/writes first (see ACD-113) — tracked
// there, not fixed here.

async function loginAndOpenJames(page) {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Pipeline' }).click();
  await page.waitForSelector('[data-testid="new-client-btn"]');
  await page.getByText('James Martinez').first().click();
  await page.getByRole('button', { name: /Session Logs/i }).click();
}

gated(FLAGS.SESSION_LOG)('James Martinez — Skill & Caregiver Sessions', () => {

  test('Skill Sessions panel visible with sessions (not empty state)', async ({ page }) => {
    await loginAndOpenJames(page);
    await expect(page.getByText('Skill Sessions')).toBeVisible();
    await expect(page.getByText('No skill sessions logged yet.')).not.toBeVisible();
  });

  test('Most recent skill session shows Mand Training at 58%', async ({ page }) => {
    await loginAndOpenJames(page);
    // Session 4 (most recent) is expanded by default — shows 58% for Mand Training
    await expect(page.getByText('Functional Communication (Mand Training)')).toBeVisible();
    await expect(page.getByText(/58% today/)).toBeVisible();
  });

  test('Most recent skill session shows 2-Step Instructions goal', async ({ page }) => {
    await loginAndOpenJames(page);
    await expect(page.getByText('Following 2-Step Instructions')).toBeVisible();
  });

  test('Log Skill Session button is enabled (skill goals exist)', async ({ page }) => {
    await loginAndOpenJames(page);
    const btn = page.getByRole('button', { name: 'Log Skill Session' });
    await expect(btn).toBeVisible();
    await expect(btn).not.toBeDisabled();
  });

  test('Caregiver Training Log is visible with sessions (not empty state)', async ({ page }) => {
    await loginAndOpenJames(page);
    await expect(page.getByText('Caregiver Training Log')).toBeVisible();
    await expect(page.getByText('No caregiver training sessions logged yet.')).not.toBeVisible();
  });

  test('Most recent CT session shows Natural environment teaching goal', async ({ page }) => {
    await loginAndOpenJames(page);
    await expect(page.getByText('Natural environment teaching')).toBeVisible();
  });

  test('CT session card contains Behavior-specific praise goal', async ({ page }) => {
    await loginAndOpenJames(page);
    // Goal text is in the DOM (possibly below fold) — verify presence on page
    await expect(page.getByText('Behavior-specific praise').first()).toBeAttached();
  });

});
