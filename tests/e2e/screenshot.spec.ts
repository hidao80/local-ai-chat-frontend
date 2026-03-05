import { test, expect } from '@playwright/test';

test.describe('Full-Page Screenshot Tests', () => {
  test('capture settings screen', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `screenshots/settings-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await expect(page).toHaveTitle(/.+/);
  });

  test('capture chat screen', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Settings画面からチャット画面へ切り替え
    const chatButton = page.getByRole('button', { name: /chat/i }).first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
    }

    await page.screenshot({
      path: `screenshots/chat-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await expect(page).toHaveTitle(/.+/);
  });
});
