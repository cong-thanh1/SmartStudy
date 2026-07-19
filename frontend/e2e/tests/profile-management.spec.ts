import { expect, test } from '@playwright/test';

test.describe('Profile management', () => {
  test('reads and persists the display name', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-full-name')).toBeVisible();
    const updatedName = `Học viên E2E ${Date.now()}`;
    const response = page.waitForResponse((item) => item.url().includes('/profile/me') && item.request().method() === 'PATCH');
    await page.getByTestId('profile-full-name').fill(updatedName);
    await page.getByTestId('profile-save').click();
    expect((await response).status()).toBe(200);
    await expect(page.getByTestId('profile-success')).toBeVisible();
    await expect(page.getByTestId('sidebar-user-name')).toHaveText(updatedName);
    await page.reload();
    await expect(page.getByTestId('profile-full-name')).toHaveValue(updatedName);
  });

  test('does not submit a whitespace-only name', async ({ page }) => {
    await page.goto('/profile');
    await page.getByTestId('profile-full-name').fill('   ');
    await expect(page.getByTestId('profile-save')).toBeDisabled();
  });
});
