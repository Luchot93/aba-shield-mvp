import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;
const PORT = 5199;

export default defineConfig({
  testDir: './tests',
  // tests/rls is a separate node:test suite (ACD-90) that hits a real Supabase
  // project, not Playwright's mock seam — exclude it or every run here fails
  // on a missing SUPABASE_URL it was never meant to have.
  testIgnore: '**/rls/**',
  // Dedicated port + VITE_E2E=1 so the app boots with the mock Supabase seam
  // (backend-free auth/data/storage). A plain dev server on 5175 would run
  // WITHOUT the flag and fail every login, so we never reuse it in CI.
  // VITE_DEMO_MODE=true forces the local (no-API) draft path so assessment
  // generation works with no backend — otherwise .env.local's VITE_DEMO_MODE=false
  // would route generation through /api/generate, which has no handler in E2E and
  // hangs. Command-line env vars take precedence over .env files (dotenv doesn't
  // override existing process.env), same mechanism that makes VITE_E2E=1 apply.
  webServer: {
    command: `VITE_E2E=1 VITE_DEMO_MODE=true vite --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: CI,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Vite pre-bundles dependencies on the very first request, which can push the
  // first navigation of a worker well past the 30s default — enough to time out
  // the first test on a cold start (CI especially). 60s absorbs that one-off cost
  // without hiding genuine hangs.
  timeout: 60_000,
  retries: CI ? 1 : 0,
  // Serialize workers: parallel workers all hit `webServer` with `page.goto`
  // during its cold start/first-compile window, which reliably times out
  // multiple unrelated specs' beforeEach hooks (reproduced on pre-existing
  // files, not just new ones). One worker avoids the race entirely.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
});
