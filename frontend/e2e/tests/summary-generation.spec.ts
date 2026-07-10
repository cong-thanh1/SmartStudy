import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { uniqueTitle, createMinimalPdfBuffer } from '../utils/test-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Group 4 — Summary Generation (Tóm tắt tài liệu)
 *
 * Tests:
 *   1. Generate Full Document Summary — verify summary text and key points appear
 *   2. Generate Chapter Summary — verify chapter-specific summary appears
 *   3. Re-generate summary — verify loading state and updated results
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §3 Nhóm 4
 */

const TEST_PREFIX = 'PW_SUMMARY_TEST';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const CLEAN_PDF_PATH = path.join(FIXTURES_DIR, 'sample_clean.pdf');

test.beforeAll(async () => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(CLEAN_PDF_PATH, createMinimalPdfBuffer(
    'Chapter 1: Retrieval Augmented Generation. ' +
      'Retrieval augmented generation, or RAG, retrieves relevant document passages before generating an answer. ' +
      'Vector embeddings represent semantic meaning and similarity search returns related chunks. ' +
      'Citations allow a learner to verify that an answer is grounded in the source document. ' +
      'Chapter 2: Learning Assessment. ' +
      'A multiple choice question needs four distinct options, one correct answer, and an explanation. ' +
      'Feedback after an assessment should identify missed concepts and suggest a focused revision plan.'
  ));
});

let sharedDocId: string | null = null;

async function ensureReadyDocument(page: Page): Promise<string> {
  if (sharedDocId) return sharedDocId;

  const title = uniqueTitle(`${TEST_PREFIX}_SHARED_DOC`);

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
  const body = await uploadUrlResp.json() as { document: { id: string } };
  sharedDocId = body.document?.id;

  await expect(page.getByTestId('upload-form')).not.toBeVisible({ timeout: 10_000 });

  console.log(`[Summary Setup] Waiting for document ${sharedDocId} to become ready...`);
  await expect(page.getByTestId(`document-status-${sharedDocId}`)).toHaveText(/Sẵn sàng/i, {
    timeout: 90_000,
  });
  console.log(`[Summary Setup] ✅ Document ${sharedDocId} is ready`);

  return sharedDocId as string;
}

test.describe('Nhóm 4 — Tóm tắt tài liệu tự động (Summary)', () => {

  test('TC4.1 — Tóm tắt toàn bộ tài liệu (Full Doc)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/learning-space?docId=${docId}`);

    // Switch to summary tab
    await page.getByTestId('summary-tab').click();

    await expect(page.getByTestId('summary-full-btn')).toBeVisible();

    const summaryResponsePromise = page.waitForResponse(
      (r) => r.url().includes(`/documents/${docId}/summary`) && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.getByTestId('summary-full-btn').click();

    const summaryResp = await summaryResponsePromise;
    const body = await summaryResp.json() as any;
    expect(summaryResp.status(), `Summary API should return 2xx: ${JSON.stringify(body)}`).toBeLessThan(300);
    expect(body.summary).toBeTruthy();
    expect(body.summary.summaryText).toBeTruthy();
    expect(body.summary.keyPoints?.length).toBeGreaterThan(0);
    const generatedText = [body.summary.summaryText, ...body.summary.keyPoints].join(' ');
    expect(generatedText, 'Summary must retain a concept from the uploaded study material').toMatch(/RAG|retriev|vector|citation/i);

    await expect(page.getByTestId('summary-result-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('summary-key-points')).toBeVisible();
    await expect(page.getByTestId('summary-content')).toBeVisible();

    const contentText = await page.getByTestId('summary-content').textContent();
    expect(contentText?.length).toBeGreaterThan(10);
  });

  test('TC4.2 — Tóm tắt theo chương (Chapter Summary)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/learning-space?docId=${docId}`);

    await page.getByTestId('summary-tab').click();

    await expect(page.getByTestId('summary-chapter-btn')).toBeVisible();

    await page.getByTestId('summary-chapter-btn').click();

    // Ensure select is visible and select Chapter 1
    await expect(page.getByTestId('summary-chapter-select')).toBeVisible();
    await page.getByTestId('summary-chapter-select').selectOption({ index: 0 });

    // Re-trigger generate button
    const summaryReResponsePromise = page.waitForResponse(
      (r) => r.url().includes(`/documents/${docId}/summary`) && r.request().method() === 'POST',
      { timeout: 60_000 }
    );
    await page.getByTestId('summary-generate-btn').click();
    const summaryResp = await summaryReResponsePromise;
    const body = await summaryResp.json() as any;
    expect(summaryResp.status(), `Summary API should return 2xx: ${JSON.stringify(body)}`).toBeLessThan(300);
    expect(body.summary.chapterRef).toBeTruthy();
    expect(`${body.summary.summaryText} ${body.summary.keyPoints.join(' ')}`).toMatch(/RAG|retriev|vector|citation/i);

    await expect(page.getByTestId('summary-result-card')).toBeVisible({ timeout: 10_000 });
  });

});
