import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

test.use({ storageState: { cookies: [], origins: [] } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/test-evidence/auth');

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') return;

  const caseId = testInfo.title.match(/^A\d/)?.[0] ?? 'auth';
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${caseId}-${testInfo.project.name}.png`),
  });
});

function uniqueEmail(label: string): string {
  return `pw-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.invalid`;
}

async function openRegister(page: Page): Promise<void> {
  await page.goto('/welcome');
  await page.getByTestId('auth-register-open').click();
  await expect(page.getByTestId('auth-full-name-input')).toBeVisible();
}

async function register(page: Page, email: string): Promise<void> {
  await openRegister(page);
  await page.getByTestId('auth-full-name-input').fill('Playwright Handoff User');
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill('QaTestPassword123!');
  await page.getByTestId('auth-submit').click();
}

test.describe('Module A — Đăng ký, đăng nhập và phiên làm việc', () => {
  test('A0 — route riêng tư chuyển người chưa đăng nhập về welcome trước khi render app', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/welcome/);
    await expect(page.getByTestId('auth-login-open')).toBeVisible();
    await expect(page.getByTestId('document-library')).toHaveCount(0);
  });
  test('A1 — đăng ký thành công, lưu phiên an toàn và chuyển vào dashboard', async ({ page }) => {
    const email = uniqueEmail('register');
    const registerResponse = page.waitForResponse(
      (response) => response.url().includes('/auth/register') && response.request().method() === 'POST',
    );

    await register(page, email);

    const response = await registerResponse;
    expect(response.status()).toBe(201);
    const body = await response.json() as { tokens?: { accessToken?: string; refreshToken?: string }; user?: { id?: string; email?: string }; password?: unknown };
    expect(body.user?.id).toBeTruthy();
    expect(body.user?.email).toBe(email);
    expect(body.tokens?.accessToken).toBeTruthy();
    expect(body.tokens?.refreshToken).toBeTruthy();
    expect(body.password).toBeUndefined();

    await page.waitForURL(/dashboard/);
    await expect(page.getByTestId('document-library')).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('smartstudy_access_token'),
      refresh: localStorage.getItem('smartstudy_refresh_token'),
      stored: localStorage.getItem('smartstudy_user'),
      password: Object.values(localStorage).some((value) => value.includes('QaTestPassword123!')),
    }))).toMatchObject({ access: expect.any(String), refresh: expect.any(String), password: false });
  });

  test('A2 — chặn đăng ký trùng email với thông báo rõ ràng', async ({ page }) => {
    const email = uniqueEmail('duplicate');
    await register(page, email);
    await page.waitForURL(/dashboard/);
    await page.evaluate(() => localStorage.clear());

    const duplicateResponse = page.waitForResponse(
      (response) => response.url().includes('/auth/register') && response.request().method() === 'POST',
    );
    await register(page, email);

    expect((await duplicateResponse).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByTestId('auth-error')).toContainText(/đã được đăng ký|already/i);
    await expect(page).toHaveURL(/welcome/);
  });

  test('A3 — từ chối mật khẩu sai nhiều lần, rồi cho đăng nhập hợp lệ', async ({ page }) => {
    const email = uniqueEmail('login');
    await register(page, email);
    await page.waitForURL(/dashboard/);
    await page.evaluate(() => localStorage.clear());
    await page.goto('/welcome');
    await page.getByTestId('auth-login-open').click();

    for (let attempt = 0; attempt < 3; attempt++) {
      const failedResponse = page.waitForResponse(
        (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
      );
      await page.getByTestId('auth-email-input').fill(email);
      await page.getByTestId('auth-password-input').fill('WrongPassword123!');
      await page.getByTestId('auth-submit').click();
      expect((await failedResponse).status()).toBe(401);
      await expect(page.getByTestId('auth-error')).toBeVisible();
    }

    const successResponse = page.waitForResponse(
      (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
    );
    await page.getByTestId('auth-password-input').fill('QaTestPassword123!');
    await page.getByTestId('auth-submit').click();
    expect((await successResponse).status()).toBe(200);
    await page.waitForURL(/dashboard/);
  });

  test('A4 — refresh token khôi phục phiên; refresh token thiếu sẽ chuyển về trang đăng nhập', async ({ page }) => {
    const email = uniqueEmail('refresh');
    await register(page, email);
    await page.waitForURL(/dashboard/);

    await page.evaluate(() => localStorage.setItem('smartstudy_access_token', 'invalid-access-token'));
    const refreshResponse = page.waitForResponse(
      (response) => response.url().includes('/auth/refresh') && response.request().method() === 'POST',
    );
    await page.reload();
    expect((await refreshResponse).status()).toBe(200);
    await expect(page.getByTestId('document-library')).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem('smartstudy_access_token', 'invalid-access-token');
      localStorage.removeItem('smartstudy_refresh_token');
    });
    await page.reload();
    await page.waitForURL(/welcome/, { timeout: 15_000 });
  });

  test('A5 — logout thu hồi phiên và không để token ở client', async ({ page }) => {
    const email = uniqueEmail('logout');
    await register(page, email);
    await page.waitForURL(/dashboard/);
    const logoutResponse = page.waitForResponse(
      (response) => response.url().includes('/auth/logout') && response.request().method() === 'POST',
    );

    await page.getByTestId('logout-button').click();
    expect((await logoutResponse).status()).toBe(204);
    await page.waitForURL(/welcome/);
    await expect.poll(() => page.evaluate(() => ({
      access: localStorage.getItem('smartstudy_access_token'),
      refresh: localStorage.getItem('smartstudy_refresh_token'),
      user: localStorage.getItem('smartstudy_user'),
    }))).toEqual({ access: null, refresh: null, user: null });
  });
});
