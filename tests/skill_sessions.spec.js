import { test, expect } from '@playwright/test';
import { FLAGS } from '../src/constants/featureFlags.js';
import { loginAsAdmin } from './helpers/auth.js';

// This file mixes two Phase-2 concerns: Sofia's session logs (FLAGS.SESSION_LOG)
// and her reassessment tab (FLAGS.REASSESSMENT). They gate independently, so the
// describe is split — each block auto-skips while its flag is off.
const gated = (flag) => (flag ? test.describe : test.describe.skip);

// Both feature panels live inside the client detail view, reached via Pipeline.
async function loginAndOpenPipeline(page) {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Pipeline' }).click();
  await page.waitForSelector('[data-testid="new-client-btn"]');
}

async function openClientSessionLogs(page, clientName) {
  await page.getByText(clientName).first().click();
  await page.getByRole('button', { name: /Session Logs/i }).click();
}

gated(FLAGS.SESSION_LOG)('Sofia Ramirez — Skill Session Logs', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndOpenPipeline(page);
  });

  test('Skill Sessions panel header is visible', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    await expect(page.getByText('Skill Sessions')).toBeVisible();
  });

  test('Skill Sessions panel shows sessions logged count', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    // Panel subtitle shows "N sessions logged · Last: ..."
    // "Log Skill Session" button also present (distinct from "No sessions" empty state)
    await expect(page.getByRole('button', { name: 'Log Skill Session' })).toBeVisible();
    // Confirm no empty-state message
    await expect(page.getByText('No skill sessions logged yet.')).not.toBeVisible();
  });

  test('Most recent skill session is expanded and shows AAC goal', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    // The most recent session (session 8) is open by default
    await expect(page.getByText('Functional Communication (AAC Device)')).toBeVisible();
  });

  test('Most recent session shows AAC mastery badge', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    // Session 8 has AAC at 82% with stoStatus: 'met' — renders "Met ✓" chip
    await expect(page.getByText(/Met/i).first()).toBeVisible();
  });

  test('Skill session shows accuracy percentage for AAC goal', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    // "82% today↑" span in the most recent open skill session card
    await expect(page.getByText(/82% today/)).toBeVisible();
  });

  test('Skill sessions do NOT show "No skill sessions logged yet"', async ({ page }) => {
    await openClientSessionLogs(page, 'Sofia Ramirez');
    await expect(page.getByText('No skill sessions logged yet.')).not.toBeVisible();
  });

});

gated(FLAGS.REASSESSMENT)('Sofia Ramirez — Reassessment Tab', () => {

  test.beforeEach(async ({ page }) => {
    await loginAndOpenPipeline(page);
  });

  test('Reassessment tab shows clinical summary for Sofia (completed status)', async ({ page }) => {
    await page.getByText('Sofia Ramirez').first().click();
    await page.getByRole('button', { name: /Reassessment/i }).click();
    // Scroll down within the modal to reveal the clinical summary
    const container = page.locator('.fixed.inset-0.z-40.overflow-y-auto');
    await container.evaluate(el => el.scrollTop = el.scrollHeight / 2);
    await expect(page.getByText('Skill Acquisitions')).toBeVisible();
  });

  test('Reassessment shows AAC goal in Skill Acquisitions section', async ({ page }) => {
    await page.getByText('Sofia Ramirez').first().click();
    await page.getByRole('button', { name: /Reassessment/i }).click();
    const container = page.locator('.fixed.inset-0.z-40.overflow-y-auto');
    await container.evaluate(el => el.scrollTop = el.scrollHeight / 2);
    await expect(page.getByText('Functional Communication (AAC Device)')).toBeVisible();
  });

});
