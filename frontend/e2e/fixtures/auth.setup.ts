import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';

/**
 * Auth setup — runs once before all test suites.
 * Logs in and saves browser storage state (cookies + localStorage) to
 * fixtures/storageState.json so all other tests can reuse the authenticated session.
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §1.4:
 *   "Vì hệ thống 'đã login sẵn' theo yêu cầu, agent Antigravity chỉ cần chạy setup này
 *   1 lần đầu phiên; các spec sau đều tái dùng storageState.json"
 */

const STATE_FILE = path.join(__dirname, 'storageState.json');

const QA_EMAIL = process.env.QA_EMAIL || 'qa_user_a@test.com';
const QA_PASSWORD = process.env.QA_PASSWORD || 'QaTestPassword123!';

setup('authenticate — login once and save session', async ({ page }) => {
  // Navigate to landing page
  await page.goto('/welcome');
  await expect(page).toHaveTitle(/SmartStudy/i, { timeout: 15_000 });

  // Open login modal — click "Đăng nhập" in the header
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();

  // Wait for modal to appear
  await expect(page.getByRole('heading', { name: /đăng nhập/i })).toBeVisible();

  // Fill credentials
  await page.getByLabel(/địa chỉ email/i).fill(QA_EMAIL);
  await page.getByLabel(/mật khẩu/i).fill(QA_PASSWORD);

  // Submit
  await page.getByRole('button', { name: /đăng nhập ngay/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard/, { timeout: 20_000 });
  await expect(page.getByTestId('upload-button')).toBeVisible({ timeout: 10_000 });

  // Save session state
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: STATE_FILE });

  console.log(`✅ Auth setup complete. Session saved to: ${STATE_FILE}`);
  console.log(`   Logged in as: ${QA_EMAIL}`);
});
