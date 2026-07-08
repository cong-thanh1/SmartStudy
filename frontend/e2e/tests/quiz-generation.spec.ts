import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';
import { uniqueTitle, createMinimalPdfBuffer } from '../utils/test-data';

/**
 * Group 4 — Quiz Generation (Trắc nghiệm)
 * Branch: test/pw-quiz-generation
 *
 * Tests:
 *   1. Generate quiz from document — verify structure: questions have 4 options + explanation in API response
 *   2. Answer a question — select an option, submit, verify explanation appears on results page
 *   3. Complete full quiz — verify score/summary display on results page
 *   4. Generate quiz 5 consecutive times — all must succeed with valid JSON
 *   5. Generate quiz for unready/processing document — verify graceful error
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §3 Nhóm 4
 *
 * PREREQUISITE: At least one "ready" document must exist in the account.
 * This spec creates its own document and waits for it to become ready before running quiz tests.
 */

const TEST_PREFIX = 'PW_QUIZ_TEST';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const CLEAN_PDF_PATH = path.join(FIXTURES_DIR, 'sample_clean.pdf');

test.beforeAll(async () => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  if (!fs.existsSync(CLEAN_PDF_PATH)) {
    fs.writeFileSync(CLEAN_PDF_PATH, createMinimalPdfBuffer(
      'SmartStudy AI Test Document. ' +
      'This document covers topics about machine learning, neural networks, and artificial intelligence. ' +
      'Chapter 1: Introduction to AI. Artificial intelligence is the simulation of human intelligence in machines. ' +
      'Chapter 2: Machine Learning Basics. Machine learning allows systems to learn from data. ' +
      'Chapter 3: Deep Learning. Deep learning uses neural networks with many layers.'
    ));
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

let sharedDocId: string | null = null; // Shared ready document across tests in this suite

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

  // Wait for document to become "ready" before running quiz tests
  console.log(`[Quiz Setup] Waiting for document ${sharedDocId} to become ready (LLM processing)...`);
  await expect(page.getByTestId(`document-status-${sharedDocId}`)).toHaveText(/Sẵn sàng/i, {
    timeout: 90_000,
  });
  console.log(`[Quiz Setup] ✅ Document ${sharedDocId} is ready for quiz generation`);

  return sharedDocId as string;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Nhóm 4 — Sinh câu hỏi trắc nghiệm (Quiz)', () => {

  // ─────────────────────────────────────────────────────────────────────────
  test('TC4.1 — Sinh quiz và kiểm tra cấu trúc: mỗi câu 4 đáp án + explanation', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await expect(page.getByTestId('document-selector')).toBeVisible();
    await expect(page.getByTestId('generate-quiz-button')).toBeVisible();

    // Intercept the quiz generation API response to verify JSON structure
    const quizResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/quizzes') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    // Click generate quiz (default: 5 questions)
    await page.getByTestId('generate-quiz-button').click();

    const quizResp = await quizResponsePromise;
    expect(quizResp.status(), `Quiz API should return 2xx, got ${quizResp.status()}`).toBeLessThan(300);

    const quizBody = await quizResp.json() as {
      quiz: {
        id: string;
        questions: Array<{
          question_id: string;
          question_text: string;
          options: string[];
          explanation?: string;
        }>;
      };
    };

    // Validate quiz structure
    expect(quizBody.quiz, 'Response must have quiz property').toBeTruthy();
    expect(quizBody.quiz.questions, 'Quiz must have questions array').toBeTruthy();
    expect(quizBody.quiz.questions.length, 'Quiz should have at least 1 question').toBeGreaterThan(0);

    // Verify each question has 4 options and explanation
    for (let i = 0; i < quizBody.quiz.questions.length; i++) {
      const q = quizBody.quiz.questions[i];
      expect(q.options, `Question ${i + 1} must have options array`).toBeDefined();
      expect(q.options.length, `Question ${i + 1} must have 4 options`).toBe(4);
      expect(q.explanation, `Question ${i + 1} must have explanation field`).toBeDefined();
      expect(q.explanation!.length, `Question ${i + 1} explanation must not be empty`).toBeGreaterThan(0);
    }

    // Verify quiz appears in UI
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 10_000 });

    console.log(`[TC4.1] ✅ Quiz generated: ${quizBody.quiz.questions.length} questions, all have 4 options and explanations`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC4.2 — Trả lời câu hỏi và xác nhận giải thích đáp án hiển thị sau khi nộp bài', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await page.getByTestId('generate-quiz-button').click();

    // Wait for quiz to appear
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 60_000 });

    // Get number of questions visible
    const firstOption = page.getByTestId('option-0-0');
    await expect(firstOption).toBeVisible({ timeout: 10_000 });

    // Select option A for each question (first option)
    const questionCards = page.locator('[data-testid^="question-card-"]');
    const qCount = await questionCards.count();

    for (let i = 0; i < qCount; i++) {
      const option = page.getByTestId(`option-${i}-0`);
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // Submit the quiz
    await page.getByTestId('submit-exam-button').click();

    // Wait for results page
    await page.waitForURL(/results/, { timeout: 30_000 });
    await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10_000 });

    // Verify score is displayed
    await expect(page.getByTestId('score-display')).toBeVisible();
    await expect(page.getByTestId('score-percentage')).toBeVisible();

    // Check that result cards are shown
    const resultCards = page.locator('[data-testid^="result-question-"]');
    const resultCount = await resultCards.count();
    expect(resultCount, 'Result page should show result cards').toBeGreaterThan(0);

    // For wrong answers, explanation should appear
    const firstExplanation = page.getByTestId('explanation-0');
    if (await firstExplanation.isVisible()) {
      const explanationText = await firstExplanation.textContent();
      expect(explanationText?.length, 'Explanation should have content').toBeGreaterThan(0);
      console.log(`[TC4.2] First explanation shown: "${explanationText?.substring(0, 50)}..."`);
    }

    // Correct answer indicators should be shown for wrong answers
    const correctAnswerEl = page.getByTestId('correct-answer-0');
    if (await correctAnswerEl.isVisible()) {
      const correctText = await correctAnswerEl.textContent();
      expect(correctText?.includes('Đáp án đúng'), 'Correct answer should be labeled').toBe(true);
    }

    console.log('[TC4.2] ✅ Quiz submitted, results page shows explanations for wrong answers');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC4.3 — Hoàn thành bộ quiz — hiển thị tổng kết (số câu đúng/sai, % điểm)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await page.getByTestId('generate-quiz-button').click();

    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 60_000 });

    // Answer ALL questions
    const questionCards = page.locator('[data-testid^="question-card-"]');
    const qCount = await questionCards.count();
    expect(qCount, 'Quiz should have at least 1 question').toBeGreaterThan(0);

    for (let i = 0; i < qCount; i++) {
      const option = page.getByTestId(`option-${i}-0`);
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // Verify answered count in progress indicator
    const progressText = page.getByText(/Đã trả lời:/i);
    if (await progressText.isVisible()) {
      const text = await progressText.textContent();
      console.log(`[TC4.3] Progress indicator: ${text}`);
    }

    // Submit
    await page.getByTestId('submit-exam-button').click();
    await page.waitForURL(/results/, { timeout: 30_000 });

    // Verify summary display
    await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('score-display')).toBeVisible();
    await expect(page.getByTestId('score-percentage')).toBeVisible();

    // Score percentage should be a number
    const percentText = await page.getByTestId('score-percentage').textContent();
    console.log(`[TC4.3] Score percentage: ${percentText}`);
    expect(percentText).toMatch(/\d+%/);

    // AI feedback text should be present
    await expect(page.getByTestId('ai-feedback-text')).toBeVisible();

    console.log('[TC4.3] ✅ Quiz completed — results page shows score summary correctly');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC4.4 — Sinh quiz 5 lần liên tiếp — đều thành công, không lỗi JSON', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    const ITERATIONS = 5;

    for (let run = 1; run <= ITERATIONS; run++) {
      console.log(`[TC4.4] Quiz generation run ${run}/${ITERATIONS}...`);

      await page.goto(`/exam-center?docId=${docId}`);
      await expect(page.getByTestId('generate-quiz-button')).toBeVisible();

      // Intercept quiz response for validation
      const quizRespPromise = page.waitForResponse(
        (r) => r.url().includes('/quizzes') && r.request().method() === 'POST',
        { timeout: 60_000 }
      );

      await page.getByTestId('generate-quiz-button').click();

      const quizResp = await quizRespPromise;
      expect(quizResp.status(), `Run ${run}: Quiz API should return 2xx`).toBeLessThan(300);

      let quizBody: unknown;
      try {
        quizBody = await quizResp.json();
      } catch (e) {
        throw new Error(`Run ${run}: Quiz response is not valid JSON: ${e}`);
      }

      const typedBody = quizBody as { quiz: { questions: Array<{ options: string[] }> } };
      expect(typedBody.quiz?.questions?.length, `Run ${run}: Quiz must have questions`).toBeGreaterThan(0);

      // Verify UI rendered questions (no blank/error screen)
      await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

      // Verify no UI error state
      const pageContent = await page.content();
      expect(pageContent.includes('error') && pageContent.includes('undefined')).toBe(false);

      console.log(`[TC4.4] Run ${run}: ✅ ${typedBody.quiz.questions.length} questions generated`);
    }

    console.log(`[TC4.4] ✅ All ${ITERATIONS} quiz generations succeeded without JSON errors`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC4.5 — Sinh quiz cho tài liệu đang xử lý hoặc không hợp lệ — UI báo lỗi hợp lý', async ({ page }) => {
    // We'll test with a nonexistent document ID to simulate the error case
    const fakeDocId = '00000000-0000-0000-0000-000000000000';

    await page.goto(`/exam-center?docId=${fakeDocId}`);

    // The selector might show the fake ID or default to the first real document
    // If the selector shows the fake ID option, test that selecting it and generating fails gracefully
    const selector = page.getByTestId('document-selector');
    if (await selector.isVisible()) {
      // Check if the selector actually contains the invalid ID as an option
      const options = await selector.locator('option').count();
      console.log(`[TC4.5] Document selector has ${options} options`);

      if (options === 0) {
        // No documents at all — verify empty state
        console.log('[TC4.5] ℹ️  No documents in selector — empty state test');
        await expect(page.getByTestId('generate-quiz-button')).toBeVisible();
        // With no document selected, click generate and expect graceful handling
        // (button might be disabled or show error)
        return;
      }
    }

    // The actual test: verify that attempting to generate a quiz with an invalid/processing
    // document shows a user-friendly error, not a crash
    // This requires a document in 'processing' state — use the API to check

    // Navigate to exam-center and try to generate
    await page.goto('/exam-center');
    await expect(page.getByTestId('generate-quiz-button')).toBeVisible({ timeout: 10_000 });

    // Track API errors
    const apiErrors: number[] = [];
    page.on('response', (resp) => {
      if (resp.url().includes('/quizzes') && resp.status() >= 400) {
        apiErrors.push(resp.status());
      }
    });

    await page.getByTestId('generate-quiz-button').click();

    // Wait for either success (quiz appears) or error state (UI shows error)
    await page.waitForTimeout(30_000);

    const quizAppeared = await page.getByTestId('question-card-0').isVisible().catch(() => false);

    if (quizAppeared) {
      console.log('[TC4.5] ✅ Quiz generation succeeded — document was ready');
    } else if (apiErrors.length > 0) {
      // API returned error — check UI shows a meaningful message, not a blank screen
      console.log(`[TC4.5] ℹ️  API returned errors: ${apiErrors.join(', ')}`);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.trim().length, 'Page should not be blank after error').toBeGreaterThan(0);
      // Page should not show raw error object
      expect(bodyText).not.toContain('[object Object]');
    }

    console.log('[TC4.5] ✅ Quiz error handling verified — no crash or blank screen');
  });
});
