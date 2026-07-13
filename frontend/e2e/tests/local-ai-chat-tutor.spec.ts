import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createMinimalPdfBuffer, uniqueTitle } from '../utils/test-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/local_ai_learning.pdf');
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/test-evidence/chat');

let documentId: string | undefined;

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') return;
  const caseId = testInfo.title.match(/TC\d+\.\d+/)?.[0] ?? 'chat';
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${caseId}-${testInfo.project.name}.png`),
  });
});

test.beforeAll(() => {
  fs.writeFileSync(
    FIXTURE_PATH,
    createMinimalPdfBuffer(
      'Chapter 1: Retrieval Augmented Generation. RAG retrieves relevant document passages before generating an answer. ' +
        'Vector embeddings capture semantic meaning and similarity search finds related chunks. ' +
        'Citations let learners verify the source of an answer. ' +
        'Chapter 2: Assessment. A multiple choice question has four distinct options, one correct answer, and an explanation.',
    ),
  );
});

async function ensureReadyDocument(page: Page): Promise<string> {
  if (documentId) return documentId;

  await page.goto('/dashboard');
  await expect(page.getByTestId('document-library')).toBeVisible();
  const emptyUpload = page.getByTestId('upload-button-empty');
  if (await emptyUpload.isVisible()) {
    await emptyUpload.click();
  } else {
    await page.getByTestId('upload-button').click();
  }

  await page.getByTestId('document-title-input').fill(uniqueTitle('PW_LOCAL_AI_RAG'));
  const uploadResponse = page.waitForResponse(
    (response) => response.url().includes('/documents/upload-url') && response.request().method() === 'POST',
  );
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByTestId('file-drop-zone').click();
  await (await fileChooser).setFiles(FIXTURE_PATH);
  await page.getByTestId('upload-submit-button').click();

  const upload = await uploadResponse;
  const body = await upload.json() as { document: { id: string } };
  documentId = body.document.id;
  await expect(page.getByTestId(`document-status-${documentId}`)).toHaveText(/Sẵn sàng/i, {
    timeout: 90_000,
  });
  return documentId;
}

test.describe('AI local — Chat RAG và Tutor', () => {
  test('TC3.1 — Chat trả lời từ PDF và gắn citation thật của tài liệu', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    await expect(page.getByTestId('chat-input')).toBeVisible();

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/chat/conversations/') && response.url().includes('/messages') && response.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByTestId('chat-input').fill('What does RAG retrieve before it generates an answer?');
    await page.getByTestId('chat-send-button').click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json() as {
      assistantMessage: { content: string; citations: Array<{ documentId: string; snippet: string }> };
    };
    expect(body.assistantMessage.content.trim().length).toBeGreaterThan(0);
    expect(body.assistantMessage.citations.length).toBeGreaterThan(0);
    expect(body.assistantMessage.citations.every((citation) => citation.documentId === docId)).toBe(true);
    expect(body.assistantMessage.citations.some((citation) => /RAG|retriev|embedding/i.test(citation.snippet))).toBe(true);

    await expect(page.getByTestId('chat-assistant-message')).toBeVisible();
    await expect(page.getByTestId('chat-citation').first()).toBeVisible();
  });

  test('TC3.2 — câu hỏi ngoài tài liệu vẫn được trả lời theo ngữ cảnh tài liệu, có citation hợp lệ', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/messages') && response.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByTestId('chat-input').fill('What is the weather forecast in Hanoi tomorrow?');
    await page.getByTestId('chat-send-button').click();

    const body = await (await responsePromise).json() as {
      assistantMessage: { citations: Array<{ documentId: string; snippet: string }>; content: string };
    };
    expect(body.assistantMessage.content.trim()).not.toBe('');
    expect(body.assistantMessage.citations.length).toBeGreaterThan(0);
    expect(body.assistantMessage.citations.every((citation) => citation.documentId === docId)).toBe(true);
    await expect(page.getByTestId('chat-assistant-message')).toBeVisible();
  });

  test('TC3.3 — không gửi API khi câu hỏi rỗng hoặc chỉ có khoảng trắng', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    let messageRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/messages') && request.method() === 'POST') messageRequests += 1;
    });
    await page.getByTestId('chat-input').fill('   ');
    await expect(page.getByTestId('chat-send-button')).toBeDisabled();
    expect(messageRequests).toBe(0);
  });

  test('TC3.4 — giữ được hội thoại nhiều lượt trong cùng conversation', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    for (const question of [
      'What does RAG retrieve before generating an answer?',
      'Why are citations useful for that process?',
    ]) {
      const response = page.waitForResponse(
        (candidate) => candidate.url().includes('/messages') && candidate.request().method() === 'POST',
        { timeout: 90_000 },
      );
      await page.getByTestId('chat-input').fill(question);
      await page.getByTestId('chat-send-button').click();
      expect((await response).status()).toBe(201);
    }
    await expect(page.getByTestId('chat-user-message')).toHaveCount(2);
    await expect(page.getByTestId('chat-assistant-message')).toHaveCount(2);
  });

  test('TC8.1 — Tutor giải thích khái niệm trong tài liệu đã chọn', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    await page.getByTestId('tutor-tab').click();

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/tutor/ask') && response.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByTestId('tutor-input').fill('Explain why citations are useful in retrieval augmented generation.');
    await page.getByTestId('tutor-ask-button').click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const requestBody = response.request().postDataJSON() as { documentId?: string };
    expect(requestBody.documentId).toBe(docId);
    const body = await response.json() as { answer: string; model: string };
    expect(body.model).toBe('configured-llm');
    expect(body.answer.trim().length).toBeGreaterThan(0);
    await expect(page.getByTestId('tutor-answer')).toContainText(/\S/);
  });

  test('TC8.2 — Tutor trả lời câu hỏi ngoài tài liệu khi tắt document context', async ({ page }) => {
    const docId = await ensureReadyDocument(page);
    await page.goto(`/learning-space?docId=${docId}`);
    await page.getByTestId('tutor-tab').click();
    await page.getByTestId('tutor-use-document-context').uncheck();

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/tutor/ask') && response.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByTestId('tutor-input').fill('Compare binary search and linear search in two short sentences.');
    await page.getByTestId('tutor-ask-button').click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const requestBody = response.request().postDataJSON() as { documentId?: string };
    expect(requestBody.documentId).toBeUndefined();
    const body = await response.json() as { answer: string };
    expect(body.answer.trim().length).toBeGreaterThan(0);
    await expect(page.getByTestId('tutor-answer')).toContainText(/\S/);
  });
});
