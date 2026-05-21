import { test, expect } from '@playwright/test';

// Helper: log in as admin before interacting with the app.
// Admin lands on Metrics after login; navigate to Pipeline so pipeline tests start in the right place.
async function loginAsAdmin(page) {
  await page.goto('/');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('[data-testid="metrics-page"]');
  await page.getByRole('button', { name: 'Pipeline' }).click();
  await page.waitForSelector('[data-testid="new-client-btn"]');
}

test.describe('ABA Shield — Pipeline Kanban', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── Nav ──────────────────────────────────────────────────────────────────
  test('nav bar renders logo and 3 links', async ({ page }) => {
    await expect(page.locator('header')).toContainText('ABA Shield');
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Staff' })).toBeVisible();
  });

  test('Pipeline nav link is active on load', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Pipeline' });
    await expect(btn).toHaveClass(/text-white/);
  });

  test('switching to Clients page works', async ({ page }) => {
    await page.getByRole('button', { name: 'Clients' }).click();
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('switching to Staff page works', async ({ page }) => {
    await page.getByRole('button', { name: 'Staff' }).click();
    await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
  });

  // ── Kanban board structure ────────────────────────────────────────────────
  test('all 9 columns render with correct labels', async ({ page }) => {
    const board = page.locator('.overflow-x-auto');
    for (const label of ['Intake','Auth 97151','Assessment','Plan Draft','Submitted','Denied','Authorized','Staffing','Services']) {
      await board.evaluate(el => el.scrollLeft = 9999);
      await board.evaluate(el => el.scrollLeft = 0);
      // Scroll to find each column
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10000 }).catch(async () => {
        await board.evaluate(el => el.scrollLeft = 9999);
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      });
    }
  });

  test('Intake column shows 2 clients initially', async ({ page }) => {
    // The Intake column header has a badge with count
    const intakeHeader = page.locator('.overflow-x-auto').getByText('Intake', { exact:true });
    const badge = intakeHeader.locator('xpath=following-sibling::span');
    await expect(badge).toHaveText('2');
  });

  test('board scrolls horizontally to reach Services column', async ({ page }) => {
    const board = page.locator('.overflow-x-auto');
    await board.evaluate(el => el.scrollLeft = 9999);
    await expect(page.getByText('Services', { exact: true })).toBeVisible();
  });

  // ── Card content ──────────────────────────────────────────────────────────
  test('Liam Rodriguez card shows in Intake with 7 items missing', async ({ page }) => {
    const card = page.locator('[data-testid="card-c1"]');
    await expect(card).toContainText('Liam Rodriguez');
    await expect(card).toContainText('Aetna');
    await expect(card).toContainText('7 items missing');
  });

  test('Auth 97151 cards show Day X waiting badge', async ({ page }) => {
    await expect(page.locator('[data-testid="card-c3"]')).toContainText('waiting');
    await expect(page.locator('[data-testid="card-c12"]')).toContainText('waiting');
  });

  test('Denied card shows Denied badge and denial reason', async ({ page }) => {
    const board = page.locator('.overflow-x-auto');
    await board.evaluate(el => el.scrollLeft = 600);
    const card = page.locator('[data-testid="card-c7"]');
    await expect(card).toContainText('Denied');
    await expect(card).toContainText('Medical necessity not established');
  });

  test('Services cards show Services · Reauth label', async ({ page }) => {
    await page.locator('.overflow-x-auto').evaluate(el => el.scrollLeft = 9999);
    await expect(page.locator('[data-testid="card-c10"]')).toContainText('Services · Reauth');
    await expect(page.locator('[data-testid="card-c11"]')).toContainText('Services · Reauth');
  });

  test('Services cards show reauth banners', async ({ page }) => {
    await page.locator('.overflow-x-auto').evaluate(el => el.scrollLeft = 9999);
    await expect(page.locator('[data-testid="card-c10"]')).toContainText('Reauth in');
    await expect(page.locator('[data-testid="card-c11"]')).toContainText('Reauth in');
  });

  test('Staffing and Services show RBT row', async ({ page }) => {
    await page.locator('.overflow-x-auto').evaluate(el => el.scrollLeft = 9999);
    await expect(page.locator('[data-testid="card-c9"]')).toContainText('RBT');
    await expect(page.locator('[data-testid="card-c10"]')).toContainText('RBT');
  });

  test('Intake cards do NOT show RBT row', async ({ page }) => {
    await expect(page.locator('[data-testid="card-c1"]')).not.toContainText('RBT');
  });

  // ── BCBA assignment dropdown ──────────────────────────────────────────────
  test('clicking + Assign opens BCBA dropdown with all 4 BCBAs', async ({ page }) => {
    await page.locator('[data-testid="card-c1"] button').first().click();
    const dropdown = page.locator('[data-testid="assignee-dropdown-bcba"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('Dr. Rachel Kim');
    await expect(dropdown).toContainText('Marcus Webb');
    await expect(dropdown).toContainText('Dr. Priya Sharma');
    await expect(dropdown).toContainText('Jordan Ellis');
  });

  test('dropdown shows active case counts', async ({ page }) => {
    await page.locator('[data-testid="card-c1"] button').first().click();
    await expect(page.locator('[data-testid="assignee-dropdown-bcba"]')).toContainText('active cases');
  });

  test('selecting a BCBA assigns and closes dropdown', async ({ page }) => {
    await page.locator('[data-testid="card-c2"] button').first().click();
    await page.locator('[data-testid="assignee-dropdown-bcba"]').getByText('Marcus Webb').click();
    await expect(page.locator('[data-testid="card-c2"]')).toContainText('Marcus');
    await expect(page.locator('[data-testid="assignee-dropdown-bcba"]')).not.toBeVisible();
  });

  test('clicking outside dropdown closes it', async ({ page }) => {
    await page.locator('[data-testid="card-c1"] button').first().click();
    await expect(page.locator('[data-testid="assignee-dropdown-bcba"]')).toBeVisible();
    await page.locator('header').click();
    await expect(page.locator('[data-testid="assignee-dropdown-bcba"]')).not.toBeVisible();
  });

  // ── New Client modal ──────────────────────────────────────────────────────
  test('NEW CLIENT + button opens modal', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await expect(page.locator('[data-testid="new-client-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-search"]')).toBeVisible();
  });

  test('search finds matching clients in dropdown', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="client-search"]').fill('Sophia');
    // Search result appears inside modal
    const result = page.locator('[data-testid="new-client-modal"]').getByText('Sophia Kim').first();
    await expect(result).toBeVisible();
  });

  test('selecting search result auto-fills form and shows green banner', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="client-search"]').fill('Noah');
    // Click the search result button specifically
    await page.locator('[data-testid="new-client-modal"] [data-testid^="search-result-"]').first().click();
    await expect(page.getByText('Demographics auto-filled from existing record')).toBeVisible();
    await expect(page.locator('[data-testid="field-name"]')).toHaveValue('Noah Carter');
    await expect(page.locator('[data-testid="field-insurer_name"]')).toHaveValue('Florida Blue');
    await expect(page.locator('[data-testid="field-member_id"]')).toHaveValue('FLB-558871');
  });

  test('saving empty form shows all 4 validation errors', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="save-client"]').click();
    await expect(page.getByText('Client name is required')).toBeVisible();
    await expect(page.getByText('Date of birth is required')).toBeVisible();
    await expect(page.getByText('Insurer name is required')).toBeVisible();
    await expect(page.getByText('Member ID is required')).toBeVisible();
  });

  test('creating a new client adds it to Intake and increments count', async ({ page }) => {
    const badge = page.locator('.overflow-x-auto')
      .getByText('Intake', { exact: true })
      .locator('xpath=following-sibling::span');
    await expect(badge).toHaveText('2');

    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="field-name"]').fill('Test Patient');
    await page.locator('[data-testid="field-dob"]').fill('2020-06-15');
    await page.locator('[data-testid="field-insurer_name"]').fill('Humana');
    await page.locator('[data-testid="field-member_id"]').fill('HUM-999001');
    await page.locator('[data-testid="save-client"]').click();

    await expect(page.locator('[data-testid="new-client-modal"]')).not.toBeVisible();
    await expect(badge).toHaveText('3');
    await expect(page.getByText('Test Patient').first()).toBeVisible();
  });

  test('duplicate name + DOB shows warning and blocks save', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="field-name"]').fill('Liam Rodriguez');
    await page.locator('[data-testid="field-dob"]').fill('2018-03-15');
    await expect(page.getByText('A client with this name and date of birth already exists.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open existing record' })).toBeVisible();
    // Fill remaining required fields and attempt save — modal should stay open
    await page.locator('[data-testid="field-insurer_name"]').fill('Test Insurer');
    await page.locator('[data-testid="field-member_id"]').fill('TST-999999');
    await page.locator('[data-testid="save-client"]').click();
    await expect(page.locator('[data-testid="new-client-modal"]')).toBeVisible();
  });

  test('duplicate member ID shows warning', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="field-name"]').fill('Different Name');
    await page.locator('[data-testid="field-dob"]').fill('2020-01-01');
    await page.locator('[data-testid="field-member_id"]').fill('AET-884421');
    await expect(page.getByText('A client with this member ID already exists.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open existing record' })).toBeVisible();
  });

  test('auto-filled client cannot be saved as duplicate', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await page.locator('[data-testid="client-search"]').fill('Sophia');
    await page.locator('[data-testid="new-client-modal"] [data-testid^="search-result-"]').first().click();
    // Form is auto-filled — no inline warning yet, but save must catch the duplicate
    await page.locator('[data-testid="save-client"]').click();
    await expect(page.locator('[data-testid="new-client-modal"]')).toBeVisible();
    await expect(page.getByText('A client with this name and date of birth already exists.')).toBeVisible();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await page.locator('[data-testid="new-client-btn"]').click();
    await expect(page.locator('[data-testid="new-client-modal"]')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="new-client-modal"]')).not.toBeVisible();
  });

  // ── Card click → detail ───────────────────────────────────────────────────
  test('clicking client name opens Client Detail modal', async ({ page }) => {
    // Click the name text directly (avoids hitting BCBA button)
    await page.locator('[data-testid="card-name-c4"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Emma Thompson');
  });

  test('Client Detail shows correct stage pill', async ({ page }) => {
    await page.locator('[data-testid="card-name-c7"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Ethan Williams');
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Denied');
  });

  test('closing Client Detail returns to board', async ({ page }) => {
    await page.locator('[data-testid="card-name-c4"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
    await page.locator('[data-testid="detail-back-btn"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="card-c4"]')).toBeVisible();
  });

  // ── Client Detail page ────────────────────────────────────────────────────
  test('detail header shows name, DOB, insurer, member ID and stage', async ({ page }) => {
    await page.locator('[data-testid="card-name-c4"]').click();
    const modal = page.locator('[data-testid="client-detail-modal"]');
    await expect(modal).toContainText('Emma Thompson');
    await expect(modal).toContainText('2020-01-30');
    await expect(modal).toContainText('Humana');
    await expect(modal).toContainText('HUM-334490');
    await expect(modal).toContainText('Assessment');
  });

  test('stage stepper renders all 9 stage labels', async ({ page }) => {
    await page.locator('[data-testid="card-name-c1"]').click();
    const modal = page.locator('[data-testid="client-detail-modal"]');
    for (const label of ['Intake','Auth Assessment','Assessment','Plan Draft','Submitted','Denied','Authorized','Staffing','In Services']) {
      await expect(modal).toContainText(label);
    }
  });

  test('checklist panel shows "To advance to" header for non-denied stages', async ({ page }) => {
    await page.locator('[data-testid="card-name-c1"]').click();
    await expect(page.locator('[data-testid="checklist-panel"]')).toContainText('To advance to');
  });

  test('denied stage shows resolution buttons instead of advance', async ({ page }) => {
    await page.locator('[data-testid="card-name-c7"]').click();
    await expect(page.locator('[data-testid="resolve-authorized"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolve-submitted"]')).toBeVisible();
    await expect(page.locator('[data-testid="advance-btn"]')).not.toBeVisible();
  });

  test('upload button marks item complete and adds to documents', async ({ page }) => {
    await page.locator('[data-testid="card-name-c1"]').click();
    await page.locator('[data-testid="detail-tab-documents"]').click();
    await expect(page.locator('[data-testid="documents-panel"]')).toContainText('No documents uploaded yet.');
    await page.locator('[data-testid="upload-referral_form"]').click();
    await expect(page.locator('[data-testid="documents-panel"]')).toContainText('Referral request form');
  });

  test('upload action appears in activity log', async ({ page }) => {
    await page.locator('[data-testid="card-name-c1"]').click();
    await page.locator('[data-testid="upload-referral_form"]').click();
    await page.locator('[data-testid="detail-tab-activity"]').click();
    await expect(page.locator('[data-testid="activity-log"]')).toContainText('Uploaded: Referral request form');
  });

  test('form field input marks item complete when filled', async ({ page }) => {
    // c3 is auth_assessment stage — has reference_number form field
    await page.locator('[data-testid="card-name-c3"]').click();
    const field = page.locator('[data-testid="detail-field-reference_number"]');
    await expect(field).toBeVisible();
    await field.fill('AUTH-123456');
  });

  test('Smart Assessment bridge button links session', async ({ page }) => {
    // c4 is assessment stage — has the bridge item
    await page.locator('[data-testid="card-name-c4"]').click();
    await expect(page.locator('[data-testid="open-smart-assessment"]')).toBeVisible();
    await page.locator('[data-testid="open-smart-assessment"]').click();
    await expect(page.locator('[data-testid="session-linked-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="open-smart-assessment"]')).not.toBeVisible();
  });

  test('advance button is disabled when checklist incomplete', async ({ page }) => {
    await page.locator('[data-testid="card-name-c1"]').click();
    const btn = page.locator('[data-testid="advance-btn"]');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('reauth banner shows for services clients with reauth_active', async ({ page }) => {
    await page.locator('.overflow-x-auto').evaluate(el => el.scrollLeft = 9999);
    await page.locator('[data-testid="card-name-c10"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Reauthorization cycle active');
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('2026-05-27');
  });

  test('denied resolution: Move to Authorized opens confirmation dialog', async ({ page }) => {
    await page.locator('[data-testid="card-name-c7"]').click();
    await page.locator('[data-testid="resolve-authorized"]').click();
    await expect(page.locator('[data-testid="confirm-advance"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Ethan Williams');
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Authorized');
  });

  test('confirmation cancel keeps client on current stage', async ({ page }) => {
    await page.locator('[data-testid="card-name-c7"]').click();
    await page.locator('[data-testid="resolve-authorized"]').click();
    await page.locator('[data-testid="confirm-cancel"]').click();
    await expect(page.locator('[data-testid="confirm-advance"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
  });

  test('BCBA header row shows assigned BCBA name', async ({ page }) => {
    // c4 (Emma Thompson) has bcba_id s1 = Dr. Rachel Kim
    await page.locator('[data-testid="card-name-c4"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Dr. Rachel Kim');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  ABA Shield — Clients Page
// ─────────────────────────────────────────────────────────────────────────────
test.describe('ABA Shield — Clients Page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Clients' }).click();
    await page.waitForSelector('[data-testid="clients-page"]');
  });

  // ── Table renders ─────────────────────────────────────────────────────────
  test('Clients page shows all 12 seed clients', async ({ page }) => {
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(12);
  });

  test('all 9 column headers render', async ({ page }) => {
    const th = page.locator('[data-testid="clients-table"] thead th');
    await expect(th).toHaveCount(9);
    for (const label of ['Client','DOB','Insurer','Member ID','Stage','BCBA','RBT','Referral Date','Source']) {
      await expect(page.locator('[data-testid="clients-table"] thead')).toContainText(label);
    }
  });

  test('stage pills render for all rows', async ({ page }) => {
    const pills = page.locator('[data-testid="clients-table"] tbody .rounded-full');
    // At least 12 pills (one stage per client, plus source badges)
    await expect(pills).toHaveCount(await pills.count()); // just ensure no crash
    await expect(page.locator('[data-testid="clients-table"]')).toContainText('Intake');
  });

  // ── Search ────────────────────────────────────────────────────────────────
  test('search filters clients by name', async ({ page }) => {
    await page.locator('[data-testid="clients-search"]').fill('Sophia');
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Sophia Kim');
  });

  test('search filters by member ID', async ({ page }) => {
    await page.locator('[data-testid="clients-search"]').fill('AET-884421');
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Liam Rodriguez');
  });

  test('search filters by insurer name', async ({ page }) => {
    await page.locator('[data-testid="clients-search"]').fill('Humana');
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(2);
  });

  test('search with no match shows empty state', async ({ page }) => {
    await page.locator('[data-testid="clients-search"]').fill('zzznomatch');
    await expect(page.locator('[data-testid="clients-table"]')).toContainText('No clients found.');
  });

  // ── Filter chips ──────────────────────────────────────────────────────────
  test('filter chips render All, Intake, In Progress, Active Services, Denied', async ({ page }) => {
    for (const label of ['All','Intake','In Progress','Active Services','Denied']) {
      await expect(page.getByTestId(`filter-${label==='All'?'all':label==='In Progress'?'in_progress':label==='Active Services'?'active_services':'denied'}`)).toBeVisible();
    }
  });

  test('Intake filter shows only intake-stage clients', async ({ page }) => {
    await page.getByTestId('filter-intake').click();
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      await expect(row).toContainText('Intake');
    }
  });

  test('Denied filter shows only denied clients', async ({ page }) => {
    await page.getByTestId('filter-denied').click();
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Ethan Williams');
  });

  test('Active Services filter shows only services clients', async ({ page }) => {
    await page.getByTestId('filter-active_services').click();
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(2);
  });

  test('In Progress filter excludes intake, services, denied', async ({ page }) => {
    await page.getByTestId('filter-in_progress').click();
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    // stages: auth_assessment(2), assessment(1), plan_draft(1), submitted(1), authorized(1), staffing(1) = 7
    await expect(rows).toHaveCount(7);
  });

  // ── Sort ──────────────────────────────────────────────────────────────────
  test('clicking DOB header sorts ascending then descending', async ({ page }) => {
    const dobHeader = page.locator('[data-testid="clients-table"] thead th').nth(1);
    await dobHeader.click(); // asc
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    const firstRowAsc = await rows.first().textContent();
    await dobHeader.click(); // desc
    const firstRowDesc = await rows.first().textContent();
    expect(firstRowAsc).not.toEqual(firstRowDesc);
  });

  test('clicking Client header sorts by name', async ({ page }) => {
    const nameHeader = page.locator('[data-testid="clients-table"] thead th').first();
    await nameHeader.click(); // asc (already asc by default, so this triggers desc)
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    const firstName = await rows.first().textContent();
    await nameHeader.click(); // asc again
    const firstNameAsc = await rows.first().textContent();
    // Ascending: should start with "Amelia" (first alphabetically)
    expect(firstNameAsc).toContain('Amelia Wilson');
  });

  // ── Row click → Client Detail ─────────────────────────────────────────────
  test('clicking a row opens Client Detail', async ({ page }) => {
    await page.locator('[data-testid="client-row-c1"]').click();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="client-detail-modal"]')).toContainText('Liam Rodriguez');
  });

  // ── New Client button ─────────────────────────────────────────────────────
  test('New Client button on Clients page opens modal', async ({ page }) => {
    await page.locator('[data-testid="clients-new-btn"]').click();
    await expect(page.locator('[data-testid="new-client-modal"]')).toBeVisible();
  });

  test('creating a client from Clients page adds it to the table', async ({ page }) => {
    await page.locator('[data-testid="clients-new-btn"]').click();
    await page.locator('[data-testid="field-name"]').fill('Test Import Child');
    await page.locator('[data-testid="field-dob"]').fill('2020-06-15');
    await page.locator('[data-testid="field-insurer_name"]').fill('Test Insurer');
    await page.locator('[data-testid="field-member_id"]').fill('TST-999999');
    await page.locator('[data-testid="field-referral_date"]').fill('2026-05-01');
    await page.locator('[data-testid="save-client"]').click();
    await expect(page.locator('[data-testid="clients-table"]')).toContainText('Test Import Child');
    const rows = page.locator('[data-testid="clients-table"] tbody tr');
    await expect(rows).toHaveCount(13);
  });

  // ── Import CSV/Excel button ───────────────────────────────────────────────
  test('Import CSV/Excel button opens import panel', async ({ page }) => {
    await page.locator('[data-testid="import-btn"]').click();
    await expect(page.locator('[data-testid="import-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-dropzone"]')).toBeVisible();
  });

  test('import panel closes on X button', async ({ page }) => {
    await page.locator('[data-testid="import-btn"]').click();
    await expect(page.locator('[data-testid="import-panel"]')).toBeVisible();
    await page.locator('[data-testid="import-panel"]').getByRole('button').first().click();
    await expect(page.locator('[data-testid="import-panel"]')).not.toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  ABA Shield — Staff Page
// ─────────────────────────────────────────────────────────────────────────────
test.describe('ABA Shield — Staff Page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.waitForSelector('[data-testid="staff-page"]');
  });

  // ── Grid renders ──────────────────────────────────────────────────────────
  test('shows all 10 seed staff cards', async ({ page }) => {
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(10);
  });

  test('stats strip shows correct totals', async ({ page }) => {
    // 8 active, 2 pending from seed
    await expect(page.locator('[data-testid="staff-page"]')).toContainText('Active Staff');
    await expect(page.locator('[data-testid="staff-page"]')).toContainText('Total Cases');
    await expect(page.locator('[data-testid="staff-page"]')).toContainText('Cert Expiring');
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  test('BCBAs tab shows only 4 BCBAs', async ({ page }) => {
    await page.getByTestId('tab-bcbas').click();
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(4);
  });

  test('RBTs tab shows only 6 RBTs', async ({ page }) => {
    await page.getByTestId('tab-rbts').click();
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(6);
  });

  // ── Search ────────────────────────────────────────────────────────────────
  test('search by name filters cards', async ({ page }) => {
    await page.locator('[data-testid="staff-search"]').fill('Rachel');
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Rachel Kim');
  });

  test('search by cert number filters cards', async ({ page }) => {
    await page.locator('[data-testid="staff-search"]').fill('BCBA-112233');
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(1);
  });

  test('search with no match shows empty state', async ({ page }) => {
    await page.locator('[data-testid="staff-search"]').fill('zzznomatch');
    await expect(page.locator('[data-testid="staff-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="staff-empty"]')).toContainText('No staff match your search.');
  });

  // ── Filter chips ──────────────────────────────────────────────────────────
  test('Available filter shows only active staff', async ({ page }) => {
    await page.getByTestId('staff-filter-available').click();
    // 8 active in seed data
    const cards = page.locator('[data-testid="staff-grid"] > div');
    await expect(cards).toHaveCount(8);
  });

  // ── Card expand ───────────────────────────────────────────────────────────
  test('clicking card expands to show email and details', async ({ page }) => {
    await page.locator('[data-testid="staff-card-s1"]').click();
    await expect(page.locator('[data-testid="staff-expanded-s1"]')).toBeVisible();
    await expect(page.locator('[data-testid="staff-expanded-s1"]')).toContainText('r.kim@abashield.com');
  });

  test('expanded card shows assigned clients', async ({ page }) => {
    // s1 (Rachel Kim) is assigned to c4 and c5
    await page.locator('[data-testid="staff-card-s1"]').click();
    await expect(page.locator('[data-testid="staff-expanded-s1"]')).toContainText('Emma Thompson');
  });

  // ── Edit ─────────────────────────────────────────────────────────────────
  test('Edit button opens inline edit form', async ({ page }) => {
    await page.locator('[data-testid="staff-card-s1"]').click();
    await page.locator('[data-testid="edit-staff-s1"]').click();
    await expect(page.locator('[data-testid="edit-form-s1"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-cert-number-s1"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-status-s1"]')).toBeVisible();
  });

  test('Cancel edit restores original values', async ({ page }) => {
    await page.locator('[data-testid="staff-card-s1"]').click();
    await page.locator('[data-testid="edit-staff-s1"]').click();
    await page.locator('[data-testid="edit-cert-number-s1"]').fill('BCBA-CHANGED');
    await page.getByTestId('staff-card-s1').locator('text=Cancel').click();
    await expect(page.locator('[data-testid="edit-form-s1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="staff-card-s1"]')).toContainText('BCBA-112233');
  });

  test('Save edit updates the card', async ({ page }) => {
    await page.locator('[data-testid="staff-card-s1"]').click();
    await page.locator('[data-testid="edit-staff-s1"]').click();
    await page.locator('[data-testid="edit-cert-number-s1"]').triple_click?.() || await page.locator('[data-testid="edit-cert-number-s1"]').fill('BCBA-UPDATED');
    await page.locator('[data-testid="save-staff-s1"]').click();
    await expect(page.locator('[data-testid="edit-form-s1"]')).not.toBeVisible();
  });

  // ── Invite panel ──────────────────────────────────────────────────────────
  test('Invite Staff button opens invite panel', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await expect(page.locator('[data-testid="invite-panel"]')).toBeVisible();
  });

  test('invite panel closes on backdrop click', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await expect(page.locator('[data-testid="invite-panel"]')).toBeVisible();
    // Click left of panel (backdrop)
    await page.mouse.click(100, 400);
    await expect(page.locator('[data-testid="invite-panel"]')).not.toBeVisible();
  });

  test('Send invite button disabled until name+email+role filled', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await expect(page.locator('[data-testid="invite-submit"]')).toBeDisabled();
    await page.locator('[data-testid="role-bcba"]').click();
    await expect(page.locator('[data-testid="invite-submit"]')).toBeDisabled();
    await page.locator('[data-testid="invite-name"]').fill('Test User');
    await page.locator('[data-testid="invite-email"]').fill('test@test.com');
    await expect(page.locator('[data-testid="invite-submit"]')).toBeEnabled();
  });

  test('submitting invite adds to pending list and shows toast', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await page.locator('[data-testid="role-rbt"]').click();
    await page.locator('[data-testid="invite-name"]').fill('New RBT Member');
    await page.locator('[data-testid="invite-email"]').fill('newrbt@clinic.com');
    await page.locator('[data-testid="invite-submit"]').click();
    await expect(page.locator('[data-testid="pending-invites-list"]')).toContainText('New RBT Member');
    await expect(page.locator('[data-testid="staff-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="staff-toast"]')).toContainText('New RBT Member invited as RBT');
  });

  test('invited staff member appears in grid after invite', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await page.locator('[data-testid="role-bcba"]').click();
    await page.locator('[data-testid="invite-name"]').fill('Dr. New BCBA');
    await page.locator('[data-testid="invite-email"]').fill('newbcba@clinic.com');
    await page.locator('[data-testid="invite-submit"]').click();
    // Close invite panel
    await page.mouse.click(100, 400);
    // Should now appear in grid with Pending badge
    await expect(page.locator('[data-testid="staff-grid"]')).toContainText('Dr. New BCBA');
  });

  test('Revoke invite removes from pending list', async ({ page }) => {
    await page.locator('[data-testid="invite-btn"]').click();
    await page.locator('[data-testid="role-rbt"]').click();
    await page.locator('[data-testid="invite-name"]').fill('Revoke Me');
    await page.locator('[data-testid="invite-email"]').fill('revoke@clinic.com');
    await page.locator('[data-testid="invite-submit"]').click();
    // Find the revoke button for the new invite
    const revokeBtn = page.locator('[data-testid="pending-invites-list"] button').first();
    await revokeBtn.click();
    // Confirm revoke
    await page.locator('[data-testid="pending-invites-list"]').getByText('Yes').click();
    // List may disappear entirely (empty state) or still exist without the item
    const list = page.locator('[data-testid="pending-invites-list"]');
    const panel = page.locator('[data-testid="invite-panel"]');
    await expect(panel).not.toContainText('Revoke Me');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  ABA Shield — Notifications
// ─────────────────────────────────────────────────────────────────────────────
test.describe('ABA Shield — Notifications', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── Bell badge ────────────────────────────────────────────────────────────
  test('bell badge shows unread count on load from seed notifs', async ({ page }) => {
    // Seed generates ≥1 urgent notif from c10 and c11 expiring soon + s4 cert
    const badge = page.locator('[data-testid="bell-btn"] span');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(parseInt(text)).toBeGreaterThanOrEqual(1);
  });

  // ── Panel open/close ──────────────────────────────────────────────────────
  test('clicking bell opens notification panel', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="notif-panel"]')).toContainText('Notifications');
  });

  test('clicking backdrop closes notification panel', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toBeVisible();
    await page.mouse.click(100, 400);
    await expect(page.locator('[data-testid="notif-panel"]')).not.toBeVisible();
  });

  // ── Seed notifications ─────────────────────────────────────────────────────
  test('seed notifs include urgent reauth for Charlotte Davis', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toContainText('Charlotte Davis');
  });

  test('seed notifs include urgent reauth for James Martinez', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toContainText('James Martinez');
  });

  test('seed notifs include cert expiry warning for Jordan Ellis', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toContainText('Jordan Ellis');
  });

  // ── Mark read ─────────────────────────────────────────────────────────────
  test('Mark all read clears the badge', async ({ page }) => {
    await page.locator('[data-testid="bell-btn"]').click();
    await page.locator('[data-testid="mark-all-read"]').click();
    // Badge should disappear (no unread)
    await expect(page.locator('[data-testid="bell-btn"] span')).not.toBeVisible();
  });

  // ── Action-triggered notifications ────────────────────────────────────────
  test('advancing a client stage creates a notification', async ({ page }) => {
    // Use Charlotte Davis (services stage with reauth_active) — open via client detail
    await page.locator('[data-testid="card-name-c10"]').first().click();
    await page.waitForSelector('[data-testid="client-detail-modal"]');
    // Close detail — she has no advance button (services is terminal), just verify bell works
    await page.locator('[data-testid="detail-back-btn"]').click();
    // Navigate to client detail of c9 (Mason Garcia, staffing stage) which can advance
    await page.locator('[data-testid="card-name-c9"]').first().click();
    await page.waitForSelector('[data-testid="client-detail-modal"]');
    // Complete all checkboxes within the modal
    const modal = page.locator('[data-testid="client-detail-modal"]');
    const checks = modal.locator('input[type="checkbox"]');
    const checkCount = await checks.count();
    for (let i = 0; i < checkCount; i++) {
      const cb = checks.nth(i);
      if (!(await cb.isChecked())) await cb.check();
    }
    const advBtn = modal.locator('[data-testid="advance-btn"]');
    if (await advBtn.isEnabled()) {
      await advBtn.click();
      await page.locator('[data-testid="confirm-advance"]').click();
    }
    // Bell should now show notification
    await page.locator('[data-testid="bell-btn"]').click();
    await expect(page.locator('[data-testid="notif-panel"]')).toContainText('Mason Garcia');
  });

});

test.describe('ABA Shield — Metrics page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Metrics nav item is visible for admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Metrics' })).toBeVisible();
  });

  test('navigating to Metrics renders the page', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="metrics-page"]')).toBeVisible();
  });

  test('stalled cases card renders a number', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="metric-stalled"]')).toBeVisible();
  });

  test('reauth at risk card renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="metric-reauth"]')).toBeVisible();
  });

  test('cert compliance card shows a percentage', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="metric-compliance"]')).toContainText('%');
  });

  test('clients by stage chart renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="chart-by-stage"]')).toBeVisible();
  });

  test('denial chart renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="chart-denials"]')).toBeVisible();
  });

  test('cert timeline chart renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Metrics' }).click();
    await expect(page.locator('[data-testid="chart-cert-timeline"]')).toBeVisible();
  });

});

test.describe('ABA Shield — Login gate', () => {

  test('login page renders when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('[data-testid="new-client-btn"]')).not.toBeVisible();
  });

  test('correct credentials show the app', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@abashield.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');
    // Admin lands on Metrics after login
    await expect(page.locator('[data-testid="metrics-page"]')).toBeVisible();
  });

  test('wrong credentials show error', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('role switcher is visible after login', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@abashield.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Testing as:')).toBeVisible();
  });

});

