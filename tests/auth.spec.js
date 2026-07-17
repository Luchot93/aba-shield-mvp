import { test, expect } from '@playwright/test';
import { E2E_ADMIN, loginAsAdmin } from './helpers/auth.js';

// Live coverage of the shipped Alpha login gate (real Supabase auth, mocked in E2E
// mode). Replaces the removed V0 "Login gate" block from pipeline.spec.js.

test.describe('Login', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage?.clear());
  });

  test('unauthenticated visit shows the sign-in page, not the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('clients-new-btn')).not.toBeVisible();
  });

  test('correct credentials land on the Clients page', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByTestId('clients-page')).toBeVisible();
  });

  test('wrong credentials show an error and stay on sign-in', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('login-submit').waitFor();
    await page.fill('input[type=email]', E2E_ADMIN.email);
    await page.fill('input[type=password]', 'not-the-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
    await expect(page.getByTestId('clients-page')).not.toBeVisible();
  });

});
