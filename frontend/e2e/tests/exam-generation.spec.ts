import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';
import { uniqueTitle, createMinimalPdfBuffer } from '../utils/test-data';

/**
 * Group 5 — Exam Generation (Đề thi thử)
 * Branch: test/pw-exam-generation
 *
 * Tests:
 *   1. Create exam with custom question count (10) — verify count in API response
 *   2. Verify difficulty/question count selector UI works correctly (preset buttons)
 *   3. Answer key NOT present in take-mode API response (security assertion)
 *   4. Answer key IS shown on results page after submission
 *   5. Request excessive question count (edge case) — verify graceful handling
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §3 Nhóm 5
 *
 * SECURITY NOTE: The exam feature intentionally hides answer keys during the exam.
 * Test TC5.3 verifies that the raw API response for an active exam does NOT contain
 * 'answer_key' or 'correct_answer' fields to prevent cheating.
 */

const TEST_PREFIX = 'PW_EXAM_TEST';
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const CLEAN_PDF_PATH = path.join(FIXTURES_DIR, 'sample_clean.pdf');

test.beforeAll(async () => {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  if (!fs.existsSync(CLEAN_PDF_PATH)) {
    fs.writeFileSync(CLEAN_PDF_PATH, createMinimalPdfBuffer(
      'SmartStudy AI Exam Test Document. ' +
      'This document is about artificial intelligence, machine learning, and data science. ' +
      'Section 1: What is AI? AI stands for Artificial Intelligence. ' +
      'Section 2: Machine Learning is a subset of AI. ' +
      'Section 3: Deep Learning uses neural networks. ' +
      'Section 4: Natural Language Processing handles text data. ' +
      'Section 5: Computer Vision processes images and video.'
    ));
  }
});

// ─── Shared state ────────────────────────────────────────────────────────────

let sharedReadyDocId: string | null = null;

async function ensureReadyDocument(page: Page): Promise<string> {
  if (sharedReadyDocId) return sharedReadyDocId;

  const title = uniqueTitle(`${TEST_PREFIX}_SHARED_DOC`);
  await page.goto('/dashboard');
  await expect(page.getByTestId('document-library')).toBeVisible();

  const emptyBtn = page.getByTestId('upload-button-empty');
  const mainBtn = page.getByTestId('upload-button');
  if (await emptyBtn.isVisible()) {
    await emptyBtn.click();
  } else {
    await mainBtn.click();
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

  const uploadResp = await uploadUrlPromise;
  const body = await uploadResp.json() as { document: { id: string } };
  sharedReadyDocId = body.document?.id;

  await expect(page.getByTestId('upload-form')).not.toBeVisible({ timeout: 10_000 });

  console.log(`[Exam Setup] Waiting for document ${sharedReadyDocId} to become ready...`);
  await expect(page.getByTestId(`document-status-${sharedReadyDocId}`)).toHaveText(/Sẵn sàng/i, {
    timeout: 240_000,
  });
  console.log(`[Exam Setup] ✅ Document ${sharedReadyDocId} ready`);
  return sharedReadyDocId as string;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Nhóm 5 — Sinh đề thi thử (Exam)', () => {

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.1 — Tạo đề thi với số câu tùy chỉnh (10 câu)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await expect(page.getByTestId('generate-exam-button')).toBeVisible();

    // Select 10 questions using the preset button
    await page.getByTestId('num-questions-10').click();

    // Verify the button is now selected (should have different styling)
    const btn10 = page.getByTestId('num-questions-10');
    const btn10Class = await btn10.getAttribute('class');
    expect(btn10Class, '10-question button should appear selected').toContain('bg-[#8A2BE2]');

    // Intercept the exam creation API
    const examResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/exams') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.getByTestId('generate-exam-button').click();

    const examResp = await examResponsePromise;
    console.log(`[DEBUG] Exam response: status=${examResp.status()}, body=${await examResp.text()}`);
    expect(examResp.status(), `Exam API should return 2xx, got ${examResp.status()}`).toBeLessThan(300);

    const examBody = await examResp.json() as {
      exam: {
        id: string;
        numQuestions: number;
        questions: Array<{ question_id: string; question_text: string; options: string[] }>;
      };
    };

    expect(examBody.exam, 'Response must have exam object').toBeTruthy();
    expect(examBody.exam.questions, 'Exam must have questions array').toBeTruthy();

    // Verify question count matches requested (10)
    // Note: if the document has fewer extractable questions than 10, the backend may return fewer
    const actualCount = examBody.exam.questions.length;
    expect(actualCount, `Exam should have ≤10 questions (got ${actualCount})`).toBeLessThanOrEqual(10);
    expect(actualCount, 'Exam should have at least 1 question').toBeGreaterThan(0);

    console.log(`[TC5.1] ✅ Exam created with ${actualCount} questions (requested 10)`);

    // UI should show the exam questions
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.2 — UI tùy chỉnh số câu/mức độ — preset buttons hoạt động', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await expect(page.getByTestId('generate-exam-button')).toBeVisible();

    // Test all question count presets
    for (const count of [5, 10, 15, 20]) {
      await page.getByTestId(`num-questions-${count}`).click();
      const btnClass = await page.getByTestId(`num-questions-${count}`).getAttribute('class');
      expect(btnClass, `${count}-question button should be selected`).toContain('bg-[#8A2BE2]');

      // Other buttons should NOT be selected
      for (const other of [5, 10, 15, 20].filter((n) => n !== count)) {
        const otherClass = await page.getByTestId(`num-questions-${other}`).getAttribute('class');
        expect(otherClass, `${other}-question button should NOT be selected when ${count} is selected`).not.toContain('bg-[#8A2BE2]');
      }
    }

    // Test all duration presets
    for (const mins of [10, 15, 30]) {
      await page.getByTestId(`duration-${mins}`).click();
      const btnClass = await page.getByTestId(`duration-${mins}`).getAttribute('class');
      expect(btnClass, `${mins}-min duration button should be selected`).toContain('bg-[#0073BB]');
    }

    console.log('[TC5.2] ✅ All preset buttons for question count and duration work correctly');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.3 — Đáp án KHÔNG lộ trong API response khi đang làm bài (mode=take)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);

    // Track all API responses related to exams
    const suspiciousResponses: string[] = [];

    page.on('response', async (response) => {
      if (response.url().includes('/exams') && response.request().method() === 'GET') {
        try {
          const text = await response.text();
          const lowerText = text.toLowerCase();
          // Check for fields that would expose answer key
          if (lowerText.includes('"answer_key"') ||
              lowerText.includes('"correct_answer"') ||
              lowerText.includes('"correctoptionindex"') ||
              lowerText.includes('"correct_option"')) {
            suspiciousResponses.push(`URL: ${response.url()}, contains answer key fields`);
          }
        } catch {
          // Response may not be JSON
        }
      }
    });

    // Also intercept the POST response (exam creation) to check take-mode structure
    const examPostPromise = page.waitForResponse(
      (r) => r.url().includes('/exams') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.getByTestId('generate-exam-button').click();

    const examPostResp = await examPostPromise;
    if (examPostResp.ok()) {
      const examBody = await examPostResp.json() as {
        exam: {
          questions: Array<{
            correct_answer?: string;
            answer_key?: string;
            correctOptionIndex?: number;
          }>;
        };
      };

      // CRITICAL SECURITY CHECK: Answer key must NOT be in the initial exam response
      for (let i = 0; i < (examBody.exam?.questions?.length ?? 0); i++) {
        const q = examBody.exam.questions[i];
        expect(
          q.correct_answer,
          `Question ${i + 1}: correct_answer must NOT be in exam creation response (security violation)`
        ).toBeUndefined();
        expect(
          q.answer_key,
          `Question ${i + 1}: answer_key must NOT be in exam creation response (security violation)`
        ).toBeUndefined();
        expect(
          q.correctOptionIndex,
          `Question ${i + 1}: correctOptionIndex must NOT be in exam creation response (security violation)`
        ).toBeUndefined();
      }

      console.log(`[TC5.3] ✅ Exam creation response: no answer keys exposed in ${examBody.exam.questions.length} questions`);
    }

    // Wait for exam UI to appear, then wait a moment to capture any additional GET requests
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);

    expect(suspiciousResponses, `SECURITY VIOLATION: Answer keys exposed in API: ${suspiciousResponses.join('; ')}`).toHaveLength(0);
    console.log('[TC5.3] ✅ No answer key fields found in any exam GET responses during exam-taking mode');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.4 — Đáp án CÓ xuất hiện sau khi nộp bài xem kết quả', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await expect(page.getByTestId('generate-exam-button')).toBeVisible();

    // Use minimum questions (5) for speed
    await page.getByTestId('num-questions-5').click();

    const examPostPromise = page.waitForResponse(
      (r) => r.url().includes('/exams') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.getByTestId('generate-exam-button').click();
    await examPostPromise;

    // Wait for exam UI
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

    // Answer all questions with option A (first option)
    const questionCards = page.locator('[data-testid^="question-card-"]');
    const qCount = await questionCards.count();

    for (let i = 0; i < qCount; i++) {
      const option = page.getByTestId(`option-${i}-0`);
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // Submit the exam
    const submitResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/submit') && r.request().method() === 'POST',
      { timeout: 30_000 }
    );

    await page.getByTestId('submit-exam-button').click();

    const submitResp = await submitResponsePromise;
    expect(submitResp.status(), `Submit should return 2xx, got ${submitResp.status()}`).toBeLessThan(300);

    const submitBody = await submitResp.json() as {
      attempt: {
        detailedResult: Array<{
          correct_answer: string;
          explanation: string;
          is_correct: boolean;
        }>;
      };
    };

    // VERIFY: After submission, answer keys ARE present in the response
    expect(submitBody.attempt?.detailedResult, 'Submit response must have detailedResult').toBeTruthy();
    expect(submitBody.attempt.detailedResult.length, 'detailedResult must have entries').toBeGreaterThan(0);

    for (let i = 0; i < submitBody.attempt.detailedResult.length; i++) {
      const detail = submitBody.attempt.detailedResult[i];
      expect(detail.correct_answer, `Question ${i + 1} submit result must have correct_answer`).toBeTruthy();
      expect(detail.explanation, `Question ${i + 1} submit result must have explanation`).toBeTruthy();
    }

    // Navigate to results page
    await page.waitForURL(/results/, { timeout: 30_000 });

    // Verify results page shows correct answers for wrong answers
    await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('score-display')).toBeVisible();

    // Look for correct answer indicators on wrong answers
    const wrongAnswerElements = page.locator('[data-testid^="correct-answer-"]');
    const wrongCount = await wrongAnswerElements.count();
    if (wrongCount > 0) {
      const firstCorrect = await wrongAnswerElements.first().textContent();
      expect(firstCorrect?.includes('Đáp án đúng'), 'Correct answer labels should appear for wrong answers').toBe(true);
      console.log(`[TC5.4] Found ${wrongCount} correct-answer labels for wrong answers`);
    }

    console.log('[TC5.4] ✅ After submission: correct answers and explanations ARE shown in results');
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.5 — Tạo đề thi với số câu quá lớn — xử lý hợp lý (không crash)', async ({ page }) => {
    const docId = await ensureReadyDocument(page);

    await page.goto(`/exam-center?docId=${docId}`);
    await expect(page.getByTestId('generate-exam-button')).toBeVisible();

    // Use 20 questions (the maximum preset) — for a short document this may exceed available content
    await page.getByTestId('num-questions-20').click();

    const examRespPromise = page.waitForResponse(
      (r) => r.url().includes('/exams') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );

    await page.getByTestId('generate-exam-button').click();

    const examResp = await examRespPromise;

    if (examResp.ok()) {
      // Backend may cap the number of questions
      const body = await examResp.json() as { exam: { questions: unknown[] } };
      const actualCount = body.exam?.questions?.length ?? 0;
      expect(actualCount, 'Should have at least 1 question even if less than requested 20').toBeGreaterThan(0);
      expect(actualCount, 'Should not exceed 20 questions').toBeLessThanOrEqual(20);

      await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 10_000 });
      console.log(`[TC5.5] ✅ Backend returned ${actualCount} questions for 20-question request — gracefully capped`);
    } else {
      // Backend may return an error (4xx) — verify UI shows a meaningful error
      console.log(`[TC5.5] Backend returned ${examResp.status()} for large question count request`);

      // UI should NOT crash or show a blank page
      await page.waitForTimeout(3000);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.trim().length, 'Page should not be blank after error').toBeGreaterThan(0);
      expect(bodyText, 'Page should not show raw error objects').not.toContain('[object Object]');

      console.log(`[TC5.5] ✅ Backend rejected request with ${examResp.status()} — UI handled gracefully`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.6 — Hủy bài làm: Hiển thị cảnh báo và quay lại trang cấu hình khi đồng ý', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/exam-center?docId=${docId}`);

    await page.getByTestId('num-questions-5').click();
    await page.getByTestId('generate-exam-button').click();
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

    // Handle dialog: Dismiss first
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('hủy bài làm');
      dialog.dismiss();
    });
    await page.getByTitle('Quay lại cài đặt').click();
    
    // Verify still taking exam
    await expect(page.getByTestId('question-card-0')).toBeVisible();

    // Handle dialog again: Accept this time
    page.once('dialog', dialog => dialog.accept());
    await page.getByTitle('Quay lại cài đặt').click();
    
    // Verify back to setup
    await expect(page.getByTestId('generate-exam-button')).toBeVisible();
    
    console.log(`[TC5.6] ✅ Exam cancellation flow works correctly`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.7 — UI Tiến độ: Cập nhật số câu đã trả lời chính xác khi chọn đáp án', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/exam-center?docId=${docId}`);

    await page.getByTestId('num-questions-5').click();
    await page.getByTestId('generate-exam-button').click();
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

    // Verify initial progress text
    await expect(page.locator('text=Đã trả lời: 0 / 5 câu')).toBeVisible();

    // Click an option in the first question
    await page.getByTestId('option-0-0').click();
    await expect(page.locator('text=Đã trả lời: 1 / 5 câu')).toBeVisible();

    // Click another option in the SAME question
    await page.getByTestId('option-0-1').click();
    await expect(page.locator('text=Đã trả lời: 1 / 5 câu')).toBeVisible(); // Count should remain 1

    // Click an option in the SECOND question
    await page.getByTestId('option-1-0').click();
    await expect(page.locator('text=Đã trả lời: 2 / 5 câu')).toBeVisible();
    
    console.log(`[TC5.7] ✅ Progress counter updates correctly`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.8 — Chấm điểm (Scoring): Tính đúng điểm số khi chọn đúng và sai', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/exam-center?docId=${docId}`);

    await page.getByTestId('num-questions-5').click();
    await page.getByTestId('generate-exam-button').click();
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

    // MockLLMProvider always returns Option A as correct_answer.
    // We will answer Q1-Q4 correctly (Option A) and Q5 incorrectly (Option B).
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`option-${i}-0`).click(); // Option A
    }
    await page.getByTestId(`option-4-1`).click(); // Option B (Incorrect for Q5)

    await page.getByTestId('submit-exam-button').click();
    
    // Wait for Results page
    await page.waitForURL(/results/, { timeout: 30_000 });
    await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10_000 });

    // Verify Score
    await expect(page.getByTestId('score-display')).toContainText('4 / 5');
    await expect(page.getByTestId('score-percentage')).toContainText('Đạt 80%');
    await expect(page.getByTestId('result-status-badge')).toContainText('Hoàn thành xuất sắc');

    // Verify Icons
    const correctIcons = page.getByTestId(/result-correct-icon-.*/);
    expect(await correctIcons.count()).toBe(4);

    const wrongIcons = page.getByTestId(/result-wrong-icon-.*/);
    expect(await wrongIcons.count()).toBe(1);

    // Verify Explanation is only shown for the wrong answer
    const explanations = page.getByTestId(/explanation-.*/);
    expect(await explanations.count()).toBe(1);
    
    console.log(`[TC5.8] ✅ Scoring logic works perfectly (4/5 correct)`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  test('TC5.9 — Bỏ qua câu hỏi: Xử lý đúng khi nộp bài mà chưa làm hết', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/exam-center?docId=${docId}`);

    await page.getByTestId('num-questions-5').click();
    await page.getByTestId('generate-exam-button').click();
    await expect(page.getByTestId('question-card-0')).toBeVisible({ timeout: 15_000 });

    // Answer only Q1 correctly
    await page.getByTestId(`option-0-0`).click();

    // Submit immediately with 4 unanswered questions
    await page.getByTestId('submit-exam-button').click();
    
    // Wait for Results page
    await page.waitForURL(/results/, { timeout: 30_000 });
    await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10_000 });

    // Verify Score is 1/5
    await expect(page.getByTestId('score-display')).toContainText('1 / 5');
    await expect(page.getByTestId('score-percentage')).toContainText('Đạt 20%');
    await expect(page.getByTestId('result-status-badge')).toContainText('Cần cố gắng thêm');

    // Verify Icons (1 correct, 4 wrong/unanswered)
    const correctIcons = page.getByTestId(/result-correct-icon-.*/);
    expect(await correctIcons.count()).toBe(1);

    const wrongIcons = page.getByTestId(/result-wrong-icon-.*/);
    expect(await wrongIcons.count()).toBe(4);

    console.log(`[TC5.9] ✅ Unanswered questions are treated as incorrect (1/5 correct)`);
  });
});
