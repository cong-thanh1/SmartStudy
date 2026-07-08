import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';
import { uniqueTitle, createMinimalPdfBuffer } from '../utils/test-data';

/**
 * Group 3 — Documents: Delete
 * Branch: test/pw-documents-delete
 *
 * Tests:
 *   1. Delete a document — confirm dialog → verify removed from list immediately (no reload)
 *   2. Reload after delete — verify deletion persisted in backend
 *   3. Cancel delete dialog — verify document still exists
 *   4. Delete while document is "processing" — verify graceful handling
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §3 Nhóm 3
 *
 * IMPORTANT: The UI uses native window.confirm() for delete confirmation.
 * Playwright handles this via page.on('dialog', ...) to auto-accept or dismiss.
 */

const TEST_PREFIX = 'PW_DELETE_TEST';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const CLEAN_PDF_PATH = path.join(FIXTURES_DIR, 'sample_clean.pdf');

test.beforeAll(async () => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  if (!fs.existsSync(CLEAN_PDF_PATH)) {
    fs.writeFileSync(CLEAN_PDF_PATH, createMinimalPdfBuffer('SmartStudy AI Delete Test Document'));
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function uploadAndGetDocId(page: Page, title: string): Promise<string | null> {
  await page.goto('/dashboard');
  await expect(page.getByTestId('document-library')).toBeVisible();

  const uploadBtn = page.getByTestId('upload-button');
  const emptyUploadBtn = page.getByTestId('upload-button-empty');
  if (await emptyUploadBtn.isVisible()) {
    await emptyUploadBtn.click();
  } else {
    await uploadBtn.click();
  }

  await expect(page.getByTestId('upload-form')).toBeVisible();
  await page.getByTestId('document-title-input').fill(title);

  // Intercept presigned URL response to get document ID
  const uploadUrlPromise = page.waitForResponse(
    (r) => r.url().includes('/documents/upload-url') && r.request().method() === 'POST',
    { timeout: 15_000 }
  );

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('file-drop-zone').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(CLEAN_PDF_PATH);

  await page.getByTestId('upload-submit-button').click();

  const uploadUrlResp = await uploadUrlPromise;
  if (!uploadUrlResp.ok()) return null;
  const body = await uploadUrlResp.json() as { document: { id: string } };
  const docId = body.document?.id;

  // Wait for modal to close
  await expect(page.getByTestId('upload-form')).not.toBeVisible({ timeout: 10_000 });

  return docId;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Nhóm 3 — Xóa tài liệu', () => {

  // ─────────────────────────────────────────────────────────────────────────
  test('TC3.1 — Xóa tài liệu và xác nhận biến mất khỏi danh sách ngay (không reload)', async ({ page }) => {
    const title = uniqueTitle(`${TEST_PREFIX}_TC1`);

    // Create a test document
    const docId = await uploadAndGetDocId(page, title);
    expect(docId, 'Should have uploaded document successfully').toBeTruthy();

    // Navigate to dashboard and verify document exists
    await page.goto('/dashboard');
    const docCard = page.getByTestId(`document-card-${docId}`);
    await expect(docCard).toBeVisible({ timeout: 10_000 });

    // Set up dialog handler to AUTO-ACCEPT the native confirm() dialog
    page.once('dialog', async (dialog) => {
      console.log(`[TC3.1] Accepting confirm dialog: "${dialog.message()}"`);
      await dialog.accept();
    });

    // Intercept DELETE request to verify it was sent
    const deleteResponsePromise = page.waitForResponse(
      (r) => r.url().includes(`/documents/${docId}`) && r.request().method() === 'DELETE',
      { timeout: 15_000 }
    );

    // Click delete button for this specific document
    await page.getByTestId(`delete-button-${docId}`).click();

    // Verify DELETE API returned success
    const deleteResp = await deleteResponsePromise;
    expect(deleteResp.status(), `DELETE should return 2xx, got ${deleteResp.status()}`).toBeLessThan(300);

    // Document card should disappear from the list WITHOUT a page reload
    await expect(page.getByTestId(`document-card-${docId}`)).not.toBeVisible({ timeout: 5_000 });

    console.log(`[TC3.1] ✅ Document ${docId} deleted and removed from list without reload`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC3.2 — Reload sau khi xóa — xác nhận xóa đã lưu ở backend', async ({ page }) => {
    const title = uniqueTitle(`${TEST_PREFIX}_TC2`);
    const docId = await uploadAndGetDocId(page, title);
    expect(docId).toBeTruthy();

    await page.goto('/dashboard');
    await expect(page.getByTestId(`document-card-${docId}`)).toBeVisible({ timeout: 10_000 });

    // Accept the confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Delete the document
    await page.getByTestId(`delete-button-${docId}`).click();
    await expect(page.getByTestId(`document-card-${docId}`)).not.toBeVisible({ timeout: 5_000 });

    // Hard reload the page
    await page.reload();
    await expect(page.getByTestId('document-library')).toBeVisible();
    await page.waitForTimeout(2000); // Wait for documents to load

    // Document should STILL be gone after reload (backend persistence confirmed)
    const cardAfterReload = page.getByTestId(`document-card-${docId}`);
    await expect(cardAfterReload).not.toBeVisible();

    console.log(`[TC3.2] ✅ Delete persisted — document ${docId} not visible after reload`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC3.3 — Hủy dialog xóa — tài liệu vẫn còn trong danh sách', async ({ page }) => {
    const title = uniqueTitle(`${TEST_PREFIX}_TC3`);
    const docId = await uploadAndGetDocId(page, title);
    expect(docId).toBeTruthy();

    await page.goto('/dashboard');
    await expect(page.getByTestId(`document-card-${docId}`)).toBeVisible({ timeout: 10_000 });

    // Set up dialog handler to DISMISS (cancel) the native confirm() dialog
    page.once('dialog', async (dialog) => {
      console.log(`[TC3.3] Dismissing confirm dialog: "${dialog.message()}"`);
      await dialog.dismiss();
    });

    // Track whether any DELETE request was sent
    let deleteRequestSent = false;
    page.on('request', (req) => {
      if (req.url().includes(`/documents/${docId}`) && req.method() === 'DELETE') {
        deleteRequestSent = true;
      }
    });

    // Click delete button
    await page.getByTestId(`delete-button-${docId}`).click();

    // Wait a moment to confirm no spurious requests
    await page.waitForTimeout(2000);

    // No DELETE request should have been sent
    expect(deleteRequestSent, 'DELETE request should not be sent when cancel is clicked').toBe(false);

    // Document should still be visible
    await expect(page.getByTestId(`document-card-${docId}`)).toBeVisible();

    console.log(`[TC3.3] ✅ Cancel delete — document ${docId} still present`);

    // Clean up: delete the document (accept this time)
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(`delete-button-${docId}`).click();
    await expect(page.getByTestId(`document-card-${docId}`)).not.toBeVisible({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC3.4 — Xóa tài liệu đang ở trạng thái "đang xử lý" — hệ thống xử lý hợp lý', async ({ page }) => {
    const title = uniqueTitle(`${TEST_PREFIX}_TC4_PROCESSING`);

    // Upload a document and immediately try to delete it (before processing completes)
    const docId = await uploadAndGetDocId(page, title);
    expect(docId).toBeTruthy();

    await page.goto('/dashboard');
    await expect(page.getByTestId(`document-card-${docId}`)).toBeVisible({ timeout: 10_000 });

    // Check initial status — should be 'uploading' or 'processing'
    const statusBadge = page.getByTestId(`document-status-${docId}`);
    const initialStatus = await statusBadge.textContent();
    console.log(`[TC3.4] Initial document status: ${initialStatus}`);

    // Accept the confirm dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Attempt to delete while potentially still processing
    await page.getByTestId(`delete-button-${docId}`).click();

    // The system should either:
    // a) Successfully delete (most likely — backend cancels the job)
    // b) Show an error message if deletion is blocked while processing
    // It should NOT crash or leave the UI in a broken state

    await page.waitForTimeout(3000);

    // Check if document is gone (most likely outcome)
    const isGone = !(await page.getByTestId(`document-card-${docId}`).isVisible().catch(() => true));

    if (isGone) {
      console.log(`[TC3.4] ✅ Document ${docId} successfully deleted while processing`);
    } else {
      // Document still present — acceptable if system blocks deletion of processing docs
      console.log(`[TC3.4] ℹ️  Document ${docId} still visible — system may prevent deletion during processing`);

      // Verify UI is still functional (not broken/crashed)
      await expect(page.getByTestId('document-library')).toBeVisible();
      await expect(page.getByTestId(`document-card-${docId}`)).toBeVisible();
    }
  });
});
