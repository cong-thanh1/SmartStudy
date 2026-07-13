import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createMinimalPdfBuffer, uniqueTitle } from '../utils/test-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/test-evidence/isolation');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const PASSWORD = 'QaTestPassword123!';

function uniqueEmail(user: string): string {
  return `pw-isolation-${user}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.invalid`;
}

async function register(context: BrowserContext, email: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/welcome`);
  await page.getByTestId('auth-register-open').click();
  await page.getByTestId('auth-full-name-input').fill(`Isolation ${email.slice(13, 14).toUpperCase()}`);
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await page.waitForURL(/dashboard/);
  return page;
}

async function upload(page: Page, title: string): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard`);
  const emptyUploadButton = page.getByTestId('upload-button-empty');
  await (await emptyUploadButton.isVisible() ? emptyUploadButton : page.getByTestId('upload-button')).click();
  await page.getByTestId('document-title-input').fill(title);
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('file-drop-zone').click();
  await (await chooser).setFiles({
    buffer: createMinimalPdfBuffer(`Private document ${title}.`),
    mimeType: 'application/pdf',
    name: 'private.pdf',
  });
  await page.getByTestId('upload-submit-button').click();
  await expect(page.getByTestId('upload-form')).not.toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
}

test('H1 — hai user không nhìn thấy tài liệu của nhau trong UI', async ({ browser }) => {
  const [contextA, contextB] = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [pageA, pageB] = await Promise.all([
      register(contextA, uniqueEmail('a')),
      register(contextB, uniqueEmail('b')),
    ]);
    const [titleA, titleB] = [uniqueTitle('PRIVATE_A'), uniqueTitle('PRIVATE_B')];

    await upload(pageA, titleA);
    await pageB.goto(`${BASE_URL}/dashboard`);
    await expect(pageB.getByText(titleA)).not.toBeVisible();

    await upload(pageB, titleB);
    await pageA.goto(`${BASE_URL}/dashboard`);
    await expect(pageA.getByText(titleB)).not.toBeVisible();
    await expect(pageA.getByText(titleA)).toBeVisible();
    await expect(pageB.getByText(titleB)).toBeVisible();

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await Promise.all([
      pageA.screenshot({ fullPage: true, path: path.join(EVIDENCE_DIR, 'H1-user-a.png') }),
      pageB.screenshot({ fullPage: true, path: path.join(EVIDENCE_DIR, 'H1-user-b.png') }),
    ]);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
