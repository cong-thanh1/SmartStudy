import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createMinimalPdfBuffer, uniqueTitle } from '../utils/test-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/test-evidence/documents');
const OVERSIZE_PDF_PATH = path.resolve(__dirname, '../fixtures/over-50mib.pdf');

test.beforeAll(() => {
  if (fs.existsSync(OVERSIZE_PDF_PATH)) return;

  fs.mkdirSync(path.dirname(OVERSIZE_PDF_PATH), { recursive: true });
  const descriptor = fs.openSync(OVERSIZE_PDF_PATH, 'w');
  try {
    fs.writeSync(descriptor, '%PDF-1.4\n');
    fs.ftruncateSync(descriptor, 50 * 1024 * 1024 + 1);
  } finally {
    fs.closeSync(descriptor);
  }
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') return;
  const caseId = testInfo.title.match(/^B\d/)?.[0] ?? 'documents';
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${caseId}-${testInfo.project.name}.png`),
  });
});

async function openUploadModal(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await expect(page.getByTestId('document-library')).toBeVisible();
  const emptyUploadButton = page.getByTestId('upload-button-empty');
  await (await emptyUploadButton.isVisible()
    ? emptyUploadButton
    : page.getByTestId('upload-button')).click();
  await expect(page.getByTestId('upload-form')).toBeVisible();
}

async function chooseFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByTestId('file-drop-zone').click();
  await (await fileChooser).setFiles(file);
}

test.describe('Module B — Upload và xử lý tài liệu', () => {
  test('B1 — upload PDF thật đi đúng chuỗi presign → MinIO PUT → complete và đạt trạng thái sẵn sàng', async ({ page }) => {
    const title = uniqueTitle('PW_HANDOFF_DOCUMENT');
    await openUploadModal(page);
    await page.getByTestId('document-title-input').fill(title);
    await chooseFile(page, {
      buffer: createMinimalPdfBuffer('SmartStudy handoff document. The core concept is retrieval augmented generation.'),
      mimeType: 'application/pdf',
      name: 'handoff-clean.pdf',
    });

    const startedAt = Date.now();
    const presignResponse = page.waitForResponse(
      (response) => response.url().includes('/documents/upload-url') && response.request().method() === 'POST',
    );
    const objectUpload = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().includes(':9000/'),
    );
    const completeResponse = page.waitForResponse(
      (response) => /\/documents\/[^/]+\/complete$/.test(new URL(response.url()).pathname)
        && response.request().method() === 'POST',
    );

    await page.getByTestId('upload-submit-button').click();
    const presign = await presignResponse;
    expect(presign.status()).toBe(201);
    const presignBody = await presign.json() as { document: { id: string }; upload: { url: string } };
    expect(presignBody.document.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(presignBody.upload.url).toContain(':9000/');
    await objectUpload;
    expect((await completeResponse).status()).toBe(202);

    await expect(page.getByTestId('upload-form')).not.toBeVisible();
    const status = page.getByTestId(`document-status-${presignBody.document.id}`);
    await expect(status).toHaveText(/sẵn sàng/i, { timeout: 90_000 });
    console.log(`B1 upload-to-ready duration: ${Date.now() - startedAt}ms`);
  });

  test('B5a — chặn tệp không phải PDF tại client, không gửi request tạo upload URL', async ({ page }) => {
    await openUploadModal(page);
    await page.getByTestId('document-title-input').fill(uniqueTitle('PW_NON_PDF'));
    await chooseFile(page, {
      buffer: Buffer.from('not a PDF'),
      mimeType: 'text/plain',
      name: 'notes.txt',
    });
    let uploadUrlRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/documents/upload-url')) uploadUrlRequests += 1;
    });

    await page.getByTestId('upload-submit-button').click();
    await expect(page.getByTestId('upload-error')).toContainText(/PDF/i);
    expect(uploadUrlRequests).toBe(0);
  });

  test('B5b — chặn tệp vượt giới hạn 50 MiB tại client, không gửi request nặng', async ({ page }) => {
    await openUploadModal(page);
    await page.getByTestId('document-title-input').fill(uniqueTitle('PW_OVERSIZE'));
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByTestId('file-drop-zone').click();
    await (await fileChooser).setFiles(OVERSIZE_PDF_PATH);
    let uploadUrlRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/documents/upload-url')) uploadUrlRequests += 1;
    });

    await page.getByTestId('upload-submit-button').click();
    await expect(page.getByTestId('upload-error')).toContainText(/50MB|50 MB|quá lớn/i);
    expect(uploadUrlRequests).toBe(0);
  });
});
