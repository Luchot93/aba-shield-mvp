import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth.js';

// Live coverage of the shipped Initial Assessment feature: opening a client's
// assessment, demographics auto-save surviving a hard reload, and the .docx
// export from the review page. Uses seeded client c10 (Charlotte Davis), whose
// assessment_session ships fully approved with real STOs on all three goal types
// → canExport() is true, so the review page's export button is enabled.
//
// Depth note (per plan): the export test stops at "download fires" — it does NOT
// inspect the .docx bytes. Headless docx/chart rendering is heavy and the byte
// content adds no coverage of the shipped flow beyond the download itself.

const CHARLOTTE = 'c10';

// From the Clients landing page: open the Assessments tab and mount Charlotte's
// assessment. The feature opens on the interview page with Demographics expanded,
// so assessment-field-reason is immediately present.
async function openCharlotteAssessment(page) {
  await page.getByRole('button', { name: 'Assessments' }).click();
  await page.getByTestId('assessments-page').waitFor();
  await page.getByTestId(`open-assessment-${CHARLOTTE}`).click();
  await page.getByTestId('assessment-field-reason').waitFor();
}

test.describe('Assessment', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
  });

  test('demographics reason edit auto-saves and survives a reload', async ({ page }) => {
    await openCharlotteAssessment(page);

    const marker = `E2E autosave marker ${Date.now()}`;
    await page.getByTestId('assessment-field-reason').fill(marker);
    // useAutoSave debounces 800ms before writing through db.js → E2E store → localStorage.
    await page.waitForTimeout(1000);

    // Hard reload. The mock session starts null on boot, so the app returns to the
    // sign-in gate — re-authenticate, then reopen the same client. The store is NOT
    // reset on reload (only __E2E_RESET__ does that, in beforeEach), so the edit
    // must have persisted via localStorage.
    await page.reload();
    await loginAsAdmin(page);
    await openCharlotteAssessment(page);

    await expect(page.getByTestId('assessment-field-reason')).toHaveValue(marker);
  });

  test('generate → approve all sections → export a .docx from the review page', async ({ page }) => {
    await openCharlotteAssessment(page);

    // interview → pre-generation checklist. Charlotte has real STOs on all three
    // goal types, so "Ready to Generate" is enabled (no STO blockers).
    await page.getByTestId('ready-to-generate-btn').click();

    // Charlotte's seed session is fully approved but carries NO draftContent, so
    // the checklist's "Review & Download" (allGenerated) path isn't offered —
    // generation is required. In demo mode (VITE_DEMO_MODE default) this builds
    // local drafts for every section with zero API cost, then auto-navigates to
    // the review page. Generation resets each section's approval to 'pending'.
    await page.getByTestId('generate-drafts-btn').click();
    await page.getByTestId('assessment-review-page').waitFor({ timeout: 30_000 });

    // canExport() requires every non-demographics section approved/skipped. After
    // generation all are 'pending' with draft content, so each renders an Approve
    // control. Click them until none remain (each click removes its own button).
    const approveButtons = page.locator('[data-testid^="approve-section-"]');
    for (let guard = 0; guard < 20; guard++) {
      if (await approveButtons.count() === 0) break;
      await approveButtons.first().click();
    }
    await expect(approveButtons).toHaveCount(0);

    // All sections approved + STOs present → canExport(c10) true → button enabled.
    const exportBtn = page.getByTestId('export-docx-btn');
    await expect(exportBtn).toBeEnabled();

    // Clicking builds the .docx locally and triggers a browser download.
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.docx');
  });

});
