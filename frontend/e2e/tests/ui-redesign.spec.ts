import { expect, test, type Page } from '@playwright/test';

const documentFixture = {
  id: 'doc-1',
  userId: 'user-1',
  title: 'Kinh tế vi mô · Chương 3',
  originalName: 'kinh-te-vi-mo.pdf',
  status: 'ready',
  chunkCount: 12,
  createdAt: '2026-07-19T00:00:00.000Z',
};

async function prepareApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('smartstudy_access_token', 'ui-test-token');
    localStorage.setItem('smartstudy_user', JSON.stringify({
      id: 'user-1',
      name: 'Minh Anh',
      email: 'minh.anh@example.test',
    }));
  });

  await page.route('**/api/v1/documents/doc-1/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preview: {
          ...documentFixture,
          pageCount: 24,
          chunks: [{
            chapterTitle: 'Độ co giãn của cầu',
            pageStart: 12,
            pageEnd: 13,
            text: 'Độ co giãn cho biết lượng cầu phản ứng như thế nào khi giá thay đổi.',
          }],
        },
      }),
    });
  });

  await page.route('**/api/v1/documents', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: [documentFixture] }),
    });
  });

  await page.route('**/api/v1/chat/conversations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
}

async function expectResponsivePage(page: Page): Promise<void> {
  await expect(page.locator('body')).toBeVisible();

  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const visibleAffordances = [...document.querySelectorAll<HTMLElement>('a, button')]
      .filter((element) => element.offsetParent !== null);

    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      wrapped: visibleAffordances
        .filter((element) => getComputedStyle(element).whiteSpace !== 'nowrap')
        .map((element) => element.textContent?.trim() || element.getAttribute('aria-label') || 'unnamed'),
    };
  });

  expect(layout.scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.wrapped, 'visible links and buttons must stay on one line').toEqual([]);
}

test('landing and authentication modal remain responsive', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1, name: 'Học sâu hơn từ tài liệu đang có.' })).toBeVisible();
  await expectResponsivePage(page);

  await page.getByTestId('auth-login-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('auth-email-input')).toBeVisible();
  await expectResponsivePage(page);
});

for (const route of ['/dashboard', '/learning?docId=doc-1', '/exam-center', '/results']) {
  test(`${route} remains responsive with representative data`, async ({ page }) => {
    await prepareApp(page);
    await page.goto(route);
    await expectResponsivePage(page);
  });
}
