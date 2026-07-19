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
          chunks: Array.from({ length: 18 }, (_, index) => ({
            chapterTitle: `Độ co giãn của cầu · Phần ${index + 1}`,
            pageStart: 12 + index,
            pageEnd: 12 + index,
            text: 'Độ co giãn cho biết lượng cầu phản ứng như thế nào khi giá thay đổi. Nội dung đủ dài để xác nhận tài liệu cuộn bên trong source reader.',
          })),
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

test('learning source reader stays viewport-bound and never lengthens the page', async ({ page }) => {
  await prepareApp(page);
  await page.goto('/learning?docId=doc-1');

  const workspace = page.getByTestId('learning-workspace');
  const chat = page.getByTestId('chat-workspace');
  await expect(workspace).toBeVisible();
  await expect(chat).toBeVisible();
  await expect(page.getByTestId('document-reader')).toHaveCount(0);

  const pageHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.getByTestId('document-reader-toggle').click();

  const reader = page.getByTestId('document-reader');
  const readerScroll = page.getByTestId('document-reader-scroll');
  await expect(reader).toBeVisible();

  const geometry = await reader.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom, height: bounds.height, viewportHeight: window.innerHeight };
  });
  const scrollGeometry = await readerScroll.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  const pageHeightAfter = await page.evaluate(() => document.documentElement.scrollHeight);

  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);
  expect(pageHeightAfter).toBeLessThanOrEqual(pageHeightBefore + 4);
});
