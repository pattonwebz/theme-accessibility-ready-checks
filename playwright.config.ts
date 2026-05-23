import { defineConfig, devices } from '@playwright/test';

// Config loader will be implemented as src/config/loader.ts
// For now use environment variables with sensible defaults.
// Playwright inherits process.env, so A11Y_THEME_SLUG is available to tests/helpers.
const baseUrl = process.env.A11Y_BASE_URL ?? 'http://localhost:8080';
const outputDir = process.env.A11Y_OUTPUT_DIR ?? 'a11y-results';

export default defineConfig({
  testDir: './tests/checks',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Serial — WP state must be consistent between tests
  outputDir: `${outputDir}/playwright-artifacts`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${outputDir}/playwright-results.json` }],
    ['html', { outputFolder: `${outputDir}/playwright-html`, open: 'never' }],
  ],
  use: {
    baseURL: baseUrl,
    video: 'retain-on-failure',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Mobile Chrome'], viewport: { width: 320, height: 568 } },
    },
  ],
});
