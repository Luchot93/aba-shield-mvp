import { test, expect } from '@playwright/test';
import { FLAGS } from '../src/constants/featureFlags.js';
import {
  CSV_ALLOWED_MIME_TYPES, CSV_MAX_SIZE_BYTES,
  SPREADSHEET_ALLOWED_MIME_TYPES, SPREADSHEET_MAX_SIZE_BYTES,
  DOCUMENT_ALLOWED_MIME_TYPES, DOCUMENT_MAX_SIZE_BYTES,
} from '../src/utils/validateFile.js';
import { loginAsAdmin, loginAsBCBA } from './helpers/auth.js';

// ACD-93 (E4): exercises src/utils/validateFile.js's three checks — MIME
// allowlist, max size, and magic-number content sniffing — through the real
// upload UI, for every surface that calls it. tests/import.spec.js already
// covers the CSV *happy path* (valid file accepted end-to-end) and the
// duplicate-member-ID flow, so this file deliberately only adds the
// *rejection* paths for ImportPanel, to avoid duplicate coverage, plus full
// coverage (reject + accept) for the surfaces with no existing spec.

function formatSize(bytes) {
  return bytes % (1024 * 1024) === 0 ? `${bytes / (1024 * 1024)}MB` : `${Math.round(bytes / 1024)}KB`;
}

// A real %PDF header so magic-number sniffing passes when we want a "valid" file.
function pdfBuffer(size = 256) {
  const header = Buffer.from('%PDF-1.4\n');
  return Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length), 0x20)]);
}

const gated = (flag) => (flag ? test.describe : test.describe.skip);

// ── LIVE: Import Clients (CSV/XLSX) ──────────────────────────────────────────
test.describe('Upload validation — Import Clients (live)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
    await page.getByTestId('import-btn').click();
    await page.getByTestId('import-panel').waitFor();
  });

  test('rejects a CSV with a disallowed MIME type', async ({ page }) => {
    await page.getByTestId('import-panel').locator('input[type=file]').setInputFiles({
      name: 'clients.csv', mimeType: 'application/json', buffer: Buffer.from('not actually csv'),
    });
    await expect(page.getByText(/File type not allowed\. Accepted: CSV\./)).toBeVisible();
  });

  test('rejects an oversized CSV', async ({ page }) => {
    await page.getByTestId('import-panel').locator('input[type=file]').setInputFiles({
      name: 'clients.csv', mimeType: CSV_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.alloc(CSV_MAX_SIZE_BYTES + 1024, 0x2c),
    });
    await expect(page.getByText(`File is too large — max size is ${formatSize(CSV_MAX_SIZE_BYTES)}.`)).toBeVisible();
  });

  test('rejects an XLSX whose content does not match its declared type', async ({ page }) => {
    await page.getByTestId('import-panel').locator('input[type=file]').setInputFiles({
      name: 'clients.xlsx', mimeType: SPREADSHEET_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.from('this is not a real zip/xlsx payload'),
    });
    await expect(page.getByText("This file's content doesn't match its type and may be corrupted or mislabeled.")).toBeVisible();
  });

  test('rejects an oversized XLSX', async ({ page }) => {
    await page.getByTestId('import-panel').locator('input[type=file]').setInputFiles({
      name: 'clients.xlsx', mimeType: SPREADSHEET_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.alloc(SPREADSHEET_MAX_SIZE_BYTES + 1024, 0x50),
    });
    await expect(page.getByText(`File is too large — max size is ${formatSize(SPREADSHEET_MAX_SIZE_BYTES)}.`)).toBeVisible();
  });

  // Valid-CSV acceptance is already proven end-to-end by
  // tests/import.spec.js ("CSV happy path imports new clients...").

});

// ── GATED: Staff bulk-invite (CSV/XLSX) — same validateFile boundary ────────
gated(FLAGS.STAFF)('Upload validation — Bulk Invite Staff', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByTestId('staff-page').waitFor();
    await page.getByTestId('bulk-import-btn').click();
    await page.getByTestId('bulk-invite-panel').waitFor();
  });

  test('rejects a CSV with a disallowed MIME type', async ({ page }) => {
    await page.getByTestId('bulk-invite-dropzone').locator('input[type=file]').setInputFiles({
      name: 'staff.csv', mimeType: 'application/json', buffer: Buffer.from('not actually csv'),
    });
    await expect(page.getByText(/File type not allowed\. Accepted: CSV\./)).toBeVisible();
  });

  test('rejects an oversized CSV', async ({ page }) => {
    await page.getByTestId('bulk-invite-dropzone').locator('input[type=file]').setInputFiles({
      name: 'staff.csv', mimeType: CSV_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.alloc(CSV_MAX_SIZE_BYTES + 1024, 0x2c),
    });
    await expect(page.getByText(`File is too large — max size is ${formatSize(CSV_MAX_SIZE_BYTES)}.`)).toBeVisible();
  });

  test('rejects an XLSX whose content does not match its declared type', async ({ page }) => {
    await page.getByTestId('bulk-invite-dropzone').locator('input[type=file]').setInputFiles({
      name: 'staff.xlsx', mimeType: SPREADSHEET_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.from('this is not a real zip/xlsx payload'),
    });
    await expect(page.getByText("This file's content doesn't match its type and may be corrupted or mislabeled.")).toBeVisible();
  });

});

// ── GATED: Client Detail checklist document uploads ─────────────────────────
// Client c1 (Liam Rodriguez) is seeded at stage 'intake' with bcba_id: u2, so
// its checklist renders several `file_upload` items (e.g. "Insurance card")
// as soon as the BCBA opens the card — no extra tab navigation needed. These
// inputs have no data-testid (unlike ImportPanel's), so they're located by
// scoping to the row that contains the item's visible label text.
gated(FLAGS.PIPELINE)('Upload validation — Client Detail document uploads', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsBCBA(page);
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.locator('[data-testid="card-name-c1"]').click();
    await page.getByTestId('client-detail-modal').waitFor();
  });

  function uploadRow(page, label) {
    return page.getByTestId('client-detail-modal').getByText(label, { exact: true }).locator('..');
  }

  test('rejects a disallowed MIME type', async ({ page }) => {
    await uploadRow(page, 'Insurance card').locator('input[type=file]').setInputFiles({
      name: 'insurance.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a'),
    });
    await expect(page.getByText(/File type not allowed\. Accepted:/)).toBeVisible();
  });

  test('rejects an oversized file', async ({ page }) => {
    await uploadRow(page, 'Insurance card').locator('input[type=file]').setInputFiles({
      name: 'insurance.pdf', mimeType: DOCUMENT_ALLOWED_MIME_TYPES[0],
      buffer: pdfBuffer(DOCUMENT_MAX_SIZE_BYTES + 1024),
    });
    await expect(page.getByText(`File is too large — max size is ${formatSize(DOCUMENT_MAX_SIZE_BYTES)}.`)).toBeVisible();
  });

  test('rejects content that does not match its declared type', async ({ page }) => {
    await uploadRow(page, 'Insurance card').locator('input[type=file]').setInputFiles({
      name: 'insurance.pdf', mimeType: DOCUMENT_ALLOWED_MIME_TYPES[0],
      buffer: Buffer.from('plain text pretending to be a pdf'),
    });
    await expect(page.getByText("This file's content doesn't match its type and may be corrupted or mislabeled.")).toBeVisible();
  });

  test('accepts a valid PDF', async ({ page }) => {
    const row = uploadRow(page, 'Insurance card');
    await row.locator('input[type=file]').setInputFiles({
      name: 'insurance.pdf', mimeType: DOCUMENT_ALLOWED_MIME_TYPES[0], buffer: pdfBuffer(),
    });
    await expect(row).toContainText('Uploaded');
  });

});

// ── GATED: Reassessment final-report upload ─────────────────────────────────
// Reached only once BOTH FLAGS.PIPELINE and FLAGS.REASSESSMENT are on, from a
// 'services'-stage client's Reassessment tab (ReassessmentCyclePanel.jsx →
// ReauthSubmissionChecklist). Client c10 is seeded at stage 'services' with
// bcba_id: u2, rbt_id: u4. Covers the same validateFile boundary as above
// through this separate call site/component.
gated(FLAGS.PIPELINE && FLAGS.REASSESSMENT)('Upload validation — Reassessment final report', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__E2E_RESET__?.());
    await loginAsBCBA(page);
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await page.locator('[data-testid="card-name-c10"]').click();
    await page.getByTestId('client-detail-modal').waitFor();
    await page.getByRole('button', { name: 'Reassessment' }).click();
  });

  test('rejects a disallowed MIME type on the final signed report', async ({ page }) => {
    const row = page.getByTestId('client-detail-modal')
      .getByText('Final signed progress report uploaded', { exact: true }).locator('..');
    await row.locator('input[type=file]').setInputFiles({
      name: 'report.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a'),
    });
    await expect(page.getByText(/File type not allowed\. Accepted:/)).toBeVisible();
  });

});
