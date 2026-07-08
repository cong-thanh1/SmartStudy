import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';
import { uniqueTitle, createMinimalPdfBuffer } from '../utils/test-data';

/**
 * Group 2 — Documents: List & Search
 * Branch: test/pw-documents-list-search
 *
 * Tests:
 *   1. Document list displays uploaded docs correctly
 *   2. Documents appear in order (most recent first)
 *   3. Search by keyword filters list correctly
 *   4. Search with no matches shows empty state (not blank/error)
 *   5. Clear search restores full list
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §3 Nhóm 2
 *
 * NOTE: The search functionality was ADDED as part of the Playwright test setup
 * (data-testid="document-search-input" added to DashboardPage.tsx) because the
 * original UI had no search bar. This is documented as an improvement in the test report.
 */

const TEST_PREFIX = 'PW_LIST_TEST';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const CLEAN_PDF_PATH = path.join(FIXTURES_DIR, 'sample_clean.pdf');

test.beforeAll(async () => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  if (!fs.existsSync(CLEAN_PDF_PATH)) {
    fs.writeFileSync(CLEAN_PDF_PATH, createMinimalPdfBuffer('SmartStudy AI List Test Document'));
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function uploadDocumentViaUI(page: Page, title: string): Promise<void> {
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

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('file-drop-zone').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(CLEAN_PDF_PATH);

  await page.getByTestId('upload-submit-button').click();
  await expect(page.getByTestId('upload-form')).not.toBeVisible({ timeout: 10_000 });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Nhóm 2 — Danh sách & Tìm kiếm tài liệu', () => {
  // Titles of documents created for this test suite
  const docTitles: string[] = [];

  test.beforeAll(async ({ browser }) => {
    // Pre-create 3 test documents for the list/search tests
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../fixtures/storageState.json'),
    });
    const page = await context.newPage();

    for (let i = 0; i < 3; i++) {
      const title = uniqueTitle(`${TEST_PREFIX}_DOC${i + 1}`);
      docTitles.push(title);
      await uploadDocumentViaUI(page, title);
      console.log(`[BeforeAll] Created test document: ${title}`);
    }

    await context.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC2.1 — Danh sách hiển thị đúng tài liệu đã tải lên', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('document-library')).toBeVisible();

    // All three test documents should appear in the list
    for (const title of docTitles) {
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    }
    console.log('[TC2.1] ✅ All 3 test documents visible in list');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC2.2 — Tài liệu sắp xếp đúng thứ tự (mới nhất lên đầu)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('document-list')).toBeVisible({ timeout: 10_000 });

    // Get all document card text content in DOM order
    const cards = page.getByTestId('document-list').locator('[data-testid^="document-card-"]');
    const count = await cards.count();
    expect(count, 'Should have at least 3 documents').toBeGreaterThanOrEqual(3);

    // The last uploaded document (docTitles[2]) should appear before docTitles[0]
    const allText = await page.getByTestId('document-list').textContent();
    const idxLast = allText?.indexOf(docTitles[2]) ?? -1;
    const idxFirst = allText?.indexOf(docTitles[0]) ?? -1;

    // Both should be found
    expect(idxLast, `Document "${docTitles[2]}" not found in list`).toBeGreaterThanOrEqual(0);
    expect(idxFirst, `Document "${docTitles[0]}" not found in list`).toBeGreaterThanOrEqual(0);

    // Most recently uploaded (docTitles[2]) should appear BEFORE (lower index) the first
    expect(idxLast, 'Most recently uploaded doc should appear first').toBeLessThan(idxFirst);

    console.log('[TC2.2] ✅ Documents sorted newest-first');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC2.3 — Tìm kiếm theo từ khóa khớp — lọc đúng kết quả', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('document-search-input')).toBeVisible();

    // Search for a unique fragment of the first test document
    const searchTarget = docTitles[0];
    const uniqueFragment = searchTarget.substring(searchTarget.length - 10); // last 10 chars (timestamp part)

    await page.getByTestId('document-search-input').fill(uniqueFragment);

    // Wait for filtering
    await page.waitForTimeout(500);

    // The searched document should be visible
    await expect(page.getByText(searchTarget)).toBeVisible({ timeout: 5_000 });

    // Other test documents with different timestamps should NOT be visible
    const otherDocs = docTitles.slice(1);
    for (const otherTitle of otherDocs) {
      // The unique timestamp part differs, so they shouldn't match
      const otherFragment = otherTitle.substring(otherTitle.length - 10);
      if (otherFragment !== uniqueFragment) {
        const otherEl = page.getByText(otherTitle);
        const visible = await otherEl.isVisible().catch(() => false);
        expect(visible, `Non-matching document "${otherTitle}" should be hidden during search`).toBe(false);
      }
    }

    console.log('[TC2.3] ✅ Search filtering works correctly');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC2.4 — Tìm kiếm không có kết quả — hiển thị trạng thái rỗng hợp lý', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('document-search-input')).toBeVisible();

    // Type a keyword that definitely won't match any document
    const nonExistentQuery = 'NONEXISTENT_XYZZY_QUERY_12345_PLAYWRIGHT';
    await page.getByTestId('document-search-input').fill(nonExistentQuery);
    await page.waitForTimeout(500);

    // The search-empty state should be shown — not an error, not a blank page
    await expect(page.getByTestId('documents-search-empty')).toBeVisible({ timeout: 5_000 });

    // The empty state should have meaningful text (not just blank)
    const emptyText = await page.getByTestId('documents-search-empty').textContent();
    expect(emptyText?.trim().length, 'Empty search state should have text').toBeGreaterThan(0);

    // No error in console
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => !e.includes('favicon')).length, `Unexpected errors: ${errors.join('; ')}`).toBe(0);

    console.log('[TC2.4] ✅ No-results state shown correctly');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC2.5 — Xóa ô tìm kiếm — khôi phục toàn bộ danh sách', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('document-search-input')).toBeVisible();

    // Apply a search first
    await page.getByTestId('document-search-input').fill('NONEXISTENT_XYZZY_QUERY');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('documents-search-empty')).toBeVisible();

    // Clear search using the clear button
    await page.getByTestId('document-search-clear').click();
    await page.waitForTimeout(500);

    // All test documents should be visible again
    await expect(page.getByTestId('document-list')).toBeVisible({ timeout: 5_000 });
    for (const title of docTitles) {
      await expect(page.getByText(title)).toBeVisible({ timeout: 5_000 });
    }

    console.log('[TC2.5] ✅ Search clear restores full list');
  });
});
