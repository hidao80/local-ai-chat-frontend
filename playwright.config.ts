import { defineConfig } from '@playwright/test';

const SCREENSHOT_SPEC = /screenshot\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // スクリーンショットはビューポートごとに撮る
    {
      name: 'mobile',
      testMatch: SCREENSHOT_SPEC,
      use: { viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablet',
      testMatch: SCREENSHOT_SPEC,
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'fhd',
      testMatch: SCREENSHOT_SPEC,
      use: { viewport: { width: 1920, height: 1080 } },
    },
    // GUI経由の機能テスト（LLMへの通信はモック）。英語UIで固定する
    {
      name: 'functional',
      testIgnore: SCREENSHOT_SPEC,
      use: { viewport: { width: 1280, height: 800 }, locale: 'en-US' },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
