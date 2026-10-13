import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FLAGS } from '../src/constants/featureFlags.js';
import { loginAsAdmin } from './helpers/auth.js';

// ACD-97: automated accessibility checks via axe-core, run inside the existing
// Playwright suite. No eslint-plugin-jsx-a11y here — this repo has no ESLint
// config at all, so a lint-based a11y setup is a separate, bigger effort than
// this ticket covers. This is runtime-only.
//
// Scoring: axe severities are critical/serious/moderate/minor. We assert zero
// critical+serious on every scanned page — those are the ones with a real,
// well-documented user impact (unusable for a screen-reader/keyboard user).
// moderate/minor are only logged to the console so the first run surfaces a
// readable report without failing CI on the long tail of pre-existing issues.
// Revisit the threshold once we've seen a real baseline (see PR/ticket notes).
function logFindings(pageName, violations) {
  const noisy = violations.filter(v => v.impact === 'moderate' || v.impact === 'minor');
  if (noisy.length === 0) return;
  console.log(`\n[a11y] ${pageName} — ${noisy.length} moderate/minor finding(s) (not failing):`);
  for (const v of noisy) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
  }
}

async function assertNoCriticalOrSerious(page, pageName) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  const detail = blocking.map(v => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n  ');
  if (blocking.length > 0) {
    console.log(`\n[a11y] ${pageName} — ${blocking.length} critical/serious violation(s):\n  ${detail}`);
  }
  logFindings(pageName, results.violations);
  // Compare a count, not the violation array itself — toEqual([]) would dump axe's
  // full nested node/rule tree into the failure diff; the readable summary is above.
  expect(blocking.length, `${pageName} has critical/serious axe violations:\n  ${detail}`).toBe(0);
}

// Same skip-while-off pattern as tests/pipeline.spec.js: these describe blocks
// exercise Phase-2 surfaces gated by a feature flag and auto-skip while the
// flag is false in Alpha, then run for real once it flips.
const gated = (flag) => (flag ? test.describe : test.describe.skip);

test.describe('Accessibility — live Alpha pages', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
  });

  test('Login page has no critical/serious violations', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await assertNoCriticalOrSerious(page, 'Login page');
  });

  test('Clients page (Intake) has no critical/serious violations', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByTestId('clients-page')).toBeVisible();
    await assertNoCriticalOrSerious(page, 'Clients page');
  });

  test('New Client form has no critical/serious violations', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByTestId('clients-new-btn').click();
    await page.getByTestId('new-client-modal').waitFor();
    await assertNoCriticalOrSerious(page, 'New Client form');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
//  Gated pages — Pipeline board, Client Detail, Staff Directory.
//  Not live in Alpha (FLAGS.PIPELINE / FLAGS.STAFF are false). These blocks
//  skip automatically today and run for real once the relevant flag flips —
//  see tests/pipeline.spec.js for the same pattern on functional coverage.
// ─────────────────────────────────────────────────────────────────────────────
gated(FLAGS.PIPELINE)('Accessibility — Pipeline board (gated)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.waitForSelector('[data-testid="new-client-btn"]');
  });

  test('Pipeline Kanban board has no critical/serious violations', async ({ page }) => {
    await assertNoCriticalOrSerious(page, 'Pipeline board');
  });

  test('Client Detail modal has no critical/serious violations', async ({ page }) => {
    await page.locator('[data-testid="card-name-c4"]').click();
    await page.getByTestId('client-detail-modal').waitFor();
    await assertNoCriticalOrSerious(page, 'Client Detail');
  });

});

gated(FLAGS.STAFF)('Accessibility — Staff Directory (gated)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.waitForSelector('[data-testid="staff-page"]');
  });

  test('Staff Directory has no critical/serious violations', async ({ page }) => {
    await assertNoCriticalOrSerious(page, 'Staff Directory');
  });

});
