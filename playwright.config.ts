import { defineConfig } from '@playwright/test';

const SCREENSHOT_SPEC = /screenshot\.spec\.ts/;
const PRODUCTION_SPEC = /production\.spec\.ts/;
// Port served by bin/start.js (the same production server as npx / bun run start)
const PRODUCTION_PORT = 4174;

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
    // Screenshots are taken per viewport
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
    // Functional tests through the GUI (LLM traffic is mocked), pinned to the English UI
    {
      name: 'functional',
      testIgnore: [SCREENSHOT_SPEC, PRODUCTION_SPEC],
      use: { viewport: { width: 1280, height: 800 }, locale: 'en-US' },
    },
    // Serve the production build with bin/start.js and verify the app works under the security headers
    {
      name: 'production',
      testMatch: PRODUCTION_SPEC,
      use: {
        baseURL: `http://localhost:${PRODUCTION_PORT}`,
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      },
    },
  ],
  webServer: [
    {
      command: 'bun run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Rebuild dist/ from the current sources before serving it
      command: 'bunx vite build && node bin/start.js',
      url: `http://localhost:${PRODUCTION_PORT}`,
      env: { PORT: String(PRODUCTION_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
