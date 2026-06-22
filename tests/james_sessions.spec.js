import { test, expect } from '@playwright/test';

async function loginAndOpenJames(page) {
  await page.goto('/');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('[data-testid="metrics-page"]');
  await page.getByRole('button', { name: 'Pipeline' }).click();
  await page.waitForSelector('[data-testid="new-client-btn"]');
  await page.getByText('James Martinez').first().click();
  await page.getByRole('button', { name: /Session Logs/i }).click();
}

test.describe('James Martinez — Skill & Caregiver Sessions', () => {

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
