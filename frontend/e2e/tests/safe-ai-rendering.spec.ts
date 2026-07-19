import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('AI content is rendered as text and cannot execute HTML', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('smartstudy_access_token', 'test-access-token');
    localStorage.setItem('smartstudy_refresh_token', 'test-refresh-token');
    localStorage.setItem('smartstudy_user', JSON.stringify({ email: 'security@test.invalid', fullName: 'Security Test', id: '11111111-1111-4111-8111-111111111111' }));
  });
  const documentId = '22222222-2222-4222-8222-222222222222';
  const conversationId = '33333333-3333-4333-8333-333333333333';
  const payload = '<img src=x onerror="window.__smartstudyXss=true"> **Nội dung an toàn**';
  await page.route('**/api/v1/documents', (route) => route.fulfill({ json: { documents: [{ createdAt: new Date().toISOString(), id: documentId, status: 'ready', title: 'Security document', userId: '11111111-1111-4111-8111-111111111111' }] } }));
  await page.route(`**/api/v1/documents/${documentId}/preview`, (route) => route.fulfill({ json: { preview: { chapters: [], chunks: [], id: documentId, pageCount: 1, title: 'Security document' } } }));
  await page.route('**/api/v1/chat/conversations?*', (route) => route.fulfill({ json: { conversations: [{ documentId, id: conversationId, title: 'Security' }] } }));
  await page.route(`**/api/v1/chat/conversations/${conversationId}/messages`, (route) => route.fulfill({ json: { messages: [{ content: payload, conversationId, createdAt: new Date().toISOString(), id: 'message-1', role: 'assistant' }] } }));
  await page.goto(`/learning?docId=${documentId}`);
  const answer = page.getByTestId('chat-assistant-message');
  await expect(answer).toContainText('<img src=x onerror="window.__smartstudyXss=true">');
  await expect(answer.locator('img')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & { __smartstudyXss?: boolean }).__smartstudyXss))).toBe(false);
});
